import os
import uuid
import shutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from src.agent import Agent

from fastapi.staticfiles import StaticFiles

# Initialize FastAPI App
app = FastAPI(
    title="Innaikku Real-Time Voice Agent Backend",
    description="Asynchronous voice agent backend using FastAPI, Pipecat, and Supabase.",
    version="1.0.0"
)

# Enable CORS for local testing from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure local upload directory for proof files
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads", "proofs"))
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))), name="uploads")

# Mount static assets if built React app frontend exists
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/", response_class=HTMLResponse)
async def get_index():
    """
    Serve the built React App mobile frontend from frontend/dist/index.html if available,
    otherwise fallback to templates/index.html.
    """
    dist_index = os.path.join(frontend_dist, "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)

    templates_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    if os.path.exists(templates_path):
        return FileResponse(templates_path)
    return HTMLResponse(
        content="<h2>Frontend not found. Please build the frontend project.</h2>",
        status_code=404
    )

@app.get("/config")
async def get_config():
    """
    Expose Supabase credentials to the frontend dynamically from .env.
    """
    return {
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", "")
    }

@app.post("/api/upload-proof")
async def upload_proof(file: UploadFile = File(...)):
    """
    Backend proof document file upload handling fallback endpoint.
    Saves document file and returns accessible local/relative URL.
    """
    try:
        ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
        unique_name = f"proof_{uuid.uuid4().hex[:10]}{ext}"
        file_path = os.path.join(UPLOADS_DIR, unique_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_url = f"/uploads/proofs/{unique_name}"
        logger.info(f"Successfully uploaded proof document file: {unique_name}")
        return JSONResponse({"url": file_url, "filename": file.filename, "success": True})
    except Exception as e:
        logger.error(f"Error uploading proof document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    mode: str = "customer",
    user_id: str = None,
    phone: str = None,
    lang: str = "ta"
):
    """
    Bi-directional streaming WebSocket endpoint.
    Initializes a new Pipecat agent for each client session.
    """
    await websocket.accept()
    logger.info(f"Accepted WebSocket connection. Mode: '{mode}', User ID: '{user_id}', Phone: '{phone}', Lang: '{lang}'")

    agent = Agent(websocket=websocket, mode=mode, user_id=user_id, phone=phone, lang=lang)
    try:
        await agent.run()
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed by the client.")
    except Exception as e:
        logger.error(f"Error in agent session: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("WebSocket session terminated and cleaned up.")

if __name__ == "__main__":
    import uvicorn
    # Read port from env or default to 8000
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Running FastAPI on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

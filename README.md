# Innaikku AI: Regional Voice-First Local Shopping Marketplace

**Innaikku AI** is a regional, mobile-first, voice-enabled local deals marketplace specifically built to connect local shop owners (vendors) and residents (customers) in **Hosur**.

---

## ⚡ Quick Start: Zero-Frontend-Setup Required!

The FastAPI backend server is pre-configured to host and serve the React frontend static files. **You do NOT need to run a separate npm or frontend development server!**

### 1. Set Up Environment Keys
Create a `.env` file inside the `backend/` directory:
```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-service-role-key-or-anon-key
GEMINI_API_KEY=your-google-gemini-api-key
SARVAM_API_KEY=your-sarvam-ai-subscription-key
```

### 2. Start the Application
1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI server launcher:
   ```bash
   python main.py
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:8000/
   ```
   *(The full React application interface will load automatically!)*

---

## 🧪 Demo Test Phone Numbers
To demonstrate the platform's features, click the **🔑 Quick Demo Sign-In** button on the login screen and toggle between these pre-configured user credentials:

*   **System Admin**: Phone `0000000000` (can approve pending shops and inspect directories).
*   **Customer**: Phone `+919876543211` (can browse products, manage wishlists, and chat with the AI shopping advisor).
*   **Approved Vendor**: Phone `+919999999999` (has a verified shop; can add products, daily offers, and see demand metrics).
*   **Pending Vendor**: Phone `+919999999901` (mock credentials showing submitted address details in read-only card layout).

---

## 📁 Key Directories

*   `backend/src/agent.py`: Holds the main FastAPI WebSocket endpoint and Google Gemini + Sarvam AI Live voice pipeline configuration.
*   `backend/supabase_schema.sql`: Contains the initial database table seeds, custom views, and triggers.
*   `backend/rls_policies_setup.sql`: Custom Row-Level Security policies to protect data access.
*   `frontend/`: The standalone React mobile frontend source folder, compiled and served by the FastAPI backend.

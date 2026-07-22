import os
from loguru import logger
from dotenv import load_dotenv

# Try-except block for backwards-compatible Pipecat runner imports
try:
    from pipecat.pipeline.runner import PipelineRunner
except ImportError:
    try:
        from pipecat.workers.runner import WorkerRunner as PipelineRunner
    except ImportError:
        # Fallback if both imports are structured differently
        class FallbackPipelineRunner:
            async def run(self, task):
                await task.run()
        PipelineRunner = FallbackPipelineRunner

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams
)
from pipecat.serializers.base_serializer import FrameSerializer
from pipecat.frames.frames import Frame, StartFrame, AudioRawFrame, InputAudioRawFrame, TranscriptionFrame, TextFrame
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.transcriptions.language import Language
from src.tools.supabase_tools import query_supabase_data, supabase_query_schema
from pipecat.adapters.schemas.function_schema import FunctionSchema

load_dotenv()

add_to_wishlist_schema = FunctionSchema(
    name="add_to_wishlist",
    description=(
        "Add a product to the customer's wishlist. "
        "The item MUST exist in the catalog (i.e. it must be offered by some vendor). "
        "This tool searches the catalog and links the item to the customer's wishlist if a matching vendor item is found."
    ),
    properties={
        "item_name": {
            "type": "string",
            "description": "The exact or approximate name of the item to add (e.g., 'smart watch', 'Rice')."
        }
    },
    required=["item_name"]
)

remove_from_wishlist_schema = FunctionSchema(
    name="remove_from_wishlist",
    description="Remove an item from the customer's wishlist.",
    properties={
        "item_name": {
            "type": "string",
            "description": "The exact or approximate name of the item to remove from your wishlist (e.g. 'smart watch', 'iPhone 15')."
        }
    },
    required=["item_name"]
)

remove_item_schema = FunctionSchema(
    name="remove_item",
    description=(
        "Remove an item from your shop catalog. "
        "This tool is ONLY available for vendors. Specify the name of the item to delete."
    ),
    properties={
        "name": {
            "type": "string",
            "description": "The name of the item to delete from your shop catalog (e.g. 'Mixie Grinder', 'iPhone 15')."
        }
    },
    required=["name"]
)

remove_offer_schema = FunctionSchema(
    name="remove_offer",
    description=(
        "Remove or cancel a discount offer for an item in your shop catalog. "
        "This tool is ONLY available for vendors. Specify the item name whose offer should be removed."
    ),
    properties={
        "item_name": {
            "type": "string",
            "description": "The name of the item whose offer you want to remove (e.g. 'iPhone 15')."
        }
    },
    required=["item_name"]
)

add_item_schema = FunctionSchema(
    name="add_item",
    description=(
        "Add a new item to your shop inventory catalog. "
        "This tool is ONLY available for vendors. You must specify the product name, category, and price."
    ),
    properties={
        "name": {
            "type": "string",
            "description": "The name of the item to add (e.g. 'Wireless Earbuds', 'Denim Jacket')."
        },
        "category": {
            "type": "string",
            "description": "The category of the item. Allowed values: 'Electronics', 'Groceries', 'Home Appliances', 'Clothing'."
        },
        "price": {
            "type": "number",
            "description": "The base retail price of the item in Rupees."
        }
    },
    required=["name", "category", "price"]
)

add_offer_schema = FunctionSchema(
    name="add_offer",
    description=(
        "Create a 24-hour discount offer for an existing item in your shop catalog. "
        "This tool is ONLY available for vendors. You must specify the item name, discount percentage, "
        "and start time. If the vendor does not mention the discount percentage or start time, "
        "the agent must ask a follow up question first."
    ),
    properties={
        "item_name": {
            "type": "string",
            "description": "The exact or approximate name of the item to apply the discount to (e.g. 'iPhone 15')."
        },
        "discount_pct": {
            "type": "number",
            "description": "The discount percentage to apply (e.g. 10.0 for 10% discount)."
        },
        "start_time": {
            "type": "string",
            "description": "The start time/date for the offer (e.g. 'today', 'tomorrow', 'tomorrow at 10 AM', or a specific date)."
        },
        "description": {
            "type": "string",
            "description": "Optional tagline or description of the offer (e.g. 'Festival special sale!')."
        }
    },
    required=["item_name", "discount_pct", "start_time"]
)

update_shop_details_schema = FunctionSchema(
    name="update_shop_details",
    description=(
        "Update the profile details of your vendor shop (name, owner_name, location). "
        "This tool is ONLY available for vendors. If no specific shop detail is specified, "
        "the agent must ask a follow up question first to clarify what needs to be updated."
    ),
    properties={
        "name": {
            "type": "string",
            "description": "The new name of the shop (e.g., 'Hosur Organic Produce')."
        },
        "owner_name": {
            "type": "string",
            "description": "The new name of the shop owner."
        },
        "location": {
            "type": "string",
            "description": "The new physical location of the shop (e.g., 'Hosur Road')."
        }
    },
    required=[]
)


class WebSocketStatusSender(FrameProcessor):
    """
    Custom FrameProcessor that intercepts TranscriptionFrames and TextFrames 
    to send real-time transcription status back to the client over WebSocket.
    """
    def __init__(self, websocket, **kwargs):
        super().__init__(**kwargs)
        self.websocket = websocket

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if "Audio" not in frame.__class__.__name__:
            logger.debug(f"WebSocketStatusSender: Received frame {frame.__class__.__name__} in direction {direction}")
        
        if isinstance(frame, TranscriptionFrame):
            if frame.user_id != "chat_user":
                logger.info(f"WebSocketStatusSender: User Transcribed text = '{frame.text}'")
                try:
                    await self.websocket.send_json({
                        "event": "user_transcription",
                        "text": frame.text
                    })
                except Exception as e:
                    logger.error(f"Error sending user transcription frame: {e}")
        elif isinstance(frame, TextFrame):
            # Avoid sending empty control strings or punctuation-only text frames
            clean_text = frame.text.strip()
            if clean_text:
                logger.info(f"WebSocketStatusSender: Bot Text Chunk = '{clean_text}'")
                try:
                    await self.websocket.send_json({
                        "event": "bot_transcription",
                        "text": clean_text
                    })
                except Exception as e:
                    logger.error(f"Error sending bot transcription frame: {e}")
        await self.push_frame(frame, direction)


class LanguageDetectorProcessor(FrameProcessor):
    """
    Custom FrameProcessor that intercepts TextFrames going to the TTS,
    detects the language dynamically using character sets, and updates
    the TTS language settings on the fly.
    """
    def __init__(self, tts_service, **kwargs):
        super().__init__(**kwargs)
        self.tts_service = tts_service

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TextFrame):
            text = frame.text.strip()
            if text:
                # Basic character block detection (Tamil / Telugu / English fallback)
                detected_lang = "en-IN"
                for char in text:
                    if '\u0b80' <= char <= '\u0bff':
                        detected_lang = "ta-IN"
                        break
                    elif '\u0c00' <= char <= '\u0c7f':
                        detected_lang = "te-IN"
                        break
                
                # Dynamically update the TTS language parameter using the correct async API
                if hasattr(self.tts_service, "_settings") and hasattr(self.tts_service._settings, "language"):
                    if self.tts_service._settings.language != detected_lang:
                        # Preserve existing settings like voice ("kavya"), model, pace, etc.
                        delta = type(self.tts_service._settings)(
                            language=detected_lang,
                            voice=self.tts_service._settings.voice,
                            pace=self.tts_service._settings.pace,
                            temperature=self.tts_service._settings.temperature,
                            model=self.tts_service._settings.model
                        )
                        await self.tts_service._update_settings(delta)
                        logger.info(f"Dynamically switched TTS language parameter to {detected_lang} (Voice: {self.tts_service._settings.voice}) based on text: '{text[:25]}...'")
        await self.push_frame(frame, direction)


# ChatTriggerProcessor has been removed since text-chat is no longer active


class STTOrderingProcessor(FrameProcessor):
    """
    Custom FrameProcessor to reorder STT and VAD events.
    Holds UserStoppedSpeakingFrame until the corresponding TranscriptionFrame arrives,
    then pushes TranscriptionFrame first, followed by UserStoppedSpeakingFrame.
    Supports zero-added-latency if transcription arrives before VAD stop, and discards
    the stop frame if no speech was transcribed (noise/cough) to prevent empty triggers.
    """
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._held_stopped_frame = None
        self._timeout_task = None
        self._has_transcription_in_turn = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        from pipecat.frames.frames import UserStoppedSpeakingFrame, TranscriptionFrame, UserStartedSpeakingFrame
        
        if isinstance(frame, UserStartedSpeakingFrame):
            self._cancel_timeout()
            self._held_stopped_frame = None
            self._has_transcription_in_turn = False
            await self.push_frame(frame, direction)
            
        elif isinstance(frame, UserStoppedSpeakingFrame):
            if self._has_transcription_in_turn:
                # We already received a non-empty transcript for this turn, so push the stop frame immediately
                logger.info("STTOrderingProcessor: Transcript already received. Forwarding UserStoppedSpeakingFrame immediately.")
                await self.push_frame(frame, direction)
            else:
                self._held_stopped_frame = frame
                self._schedule_timeout(direction)
                logger.debug("STTOrderingProcessor: Holding UserStoppedSpeakingFrame waiting for transcription")
            
        elif isinstance(frame, TranscriptionFrame):
            # Only count as valid transcription if it contains non-whitespace text
            if frame.text and frame.text.strip():
                self._has_transcription_in_turn = True
                self._cancel_timeout()
                logger.info(f"STTOrderingProcessor: Forwarding TranscriptionFrame: '{frame.text}'")
                await self.push_frame(frame, direction)
                if self._held_stopped_frame:
                    logger.debug("STTOrderingProcessor: Pushing held UserStoppedSpeakingFrame after transcription")
                    await self.push_frame(self._held_stopped_frame, direction)
                    self._held_stopped_frame = None
            else:
                # If transcript is empty, we don't treat it as a valid user speech trigger
                await self.push_frame(frame, direction)
        else:
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)

    def _schedule_timeout(self, direction):
        import asyncio
        self._cancel_timeout()
        self._timeout_task = asyncio.create_task(self._release_after_timeout(direction))

    def _cancel_timeout(self):
        if self._timeout_task:
            self._timeout_task.cancel()
            self._timeout_task = None

    async def _release_after_timeout(self, direction):
        import asyncio
        try:
            # Wait up to 1.5 seconds under latency spikes
            await asyncio.sleep(1.5)
            if self._held_stopped_frame:
                if self._has_transcription_in_turn:
                    logger.debug("STTOrderingProcessor: STT timeout reached, but transcription exists. Releasing UserStoppedSpeakingFrame")
                    await self.push_frame(self._held_stopped_frame, direction)
                else:
                    # No speech was transcribed at all during the turn (e.g. noise, cough, sigh).
                    # Suppress the stop frame to prevent triggering an empty response from the LLM.
                    logger.info("STTOrderingProcessor: STT timeout reached with no valid transcription. Discarding UserStoppedSpeakingFrame to ignore noise.")
                self._held_stopped_frame = None
        except asyncio.CancelledError:
            pass


class RawAudioSerializer(FrameSerializer):
    """
    Custom Raw Audio Serializer to bridge Pipecat AudioRawFrames 
    and raw PCM binary WebSocket messages from the browser frontend.
    """
    def __init__(self):
        super().__init__()
        self._frame_count = 0

    async def setup(self, frame: StartFrame):
        pass

    async def serialize(self, frame: Frame) -> str | bytes | None:
        # Serialize pipeline AudioRawFrames to raw audio bytes for the client
        if isinstance(frame, AudioRawFrame):
            return frame.audio
        return None

    async def deserialize(self, data: str | bytes) -> Frame | None:
        if isinstance(data, str):
            try:
                import json
                msg = json.loads(data)
                if msg.get("event") == "chat":
                    text = msg.get("text", "")
                    return TranscriptionFrame(text=text, user_id="chat_user", timestamp="")
            except Exception as e:
                logger.error(f"Error parsing text frame: {e}")
            return None
        
        self._frame_count += 1
        if self._frame_count % 100 == 0:
            logger.info(f"RawAudioSerializer: Received 100 audio frames (last size: {len(data)} bytes)")
            
        # Deserialize raw audio bytes from the client to pipeline InputAudioRawFrames
        # Assumes input format is 16kHz, mono, 16-bit PCM (2 bytes per sample)
        return InputAudioRawFrame(audio=data, sample_rate=16000, num_channels=1)


class Agent:
    """
    Agent class orchestrating the Pipecat streaming voice pipeline.
    """
    def __init__(self, websocket, mode: str = "customer", user_id: str = None, phone: str = None, lang: str = "ta"):
        self.websocket = websocket
        self.mode = mode
        self.user_id = user_id
        self.phone = phone
        self.lang = lang
        logger.info(f"Initializing voice agent in '{mode}' mode. Language: '{lang}', User: {phone} ({user_id})")

    async def run(self):
        # 1. Setup raw audio serializer
        serializer = RawAudioSerializer()

        # 2. Setup VAD Analyzer
        # Relaxed VAD thresholds to ensure regional/spoken accents aren't cut off mid-speech.
        # stop_secs is set to 0.8s to wait for a natural pause before responding.
        vad_params = VADParams(
            confidence=0.5,
            start_secs=0.2,
            stop_secs=0.8,
            min_volume=0.0
        )
        vad_analyzer = SileroVADAnalyzer(params=vad_params)

        # 3. Setup WebSocket Transport
        transport = FastAPIWebsocketTransport(
            websocket=self.websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                vad_enabled=True,
                vad_analyzer=vad_analyzer,
                serializer=serializer
            )
        )

        # 4. Setup Sarvam AI STT & TTS Services
        sarvam_api_key = os.getenv("SARVAM_API_KEY")
        if not sarvam_api_key:
            logger.error("SARVAM_API_KEY is not set. Real-time audio pipeline will fail.")

        stt = SarvamSTTService(
            api_key=sarvam_api_key,
            mode="transcribe",
            settings=SarvamSTTService.Settings(
                model="saaras:v3"
            )
        )

        # Map lang parameter to proper regional string code and user-friendly name for Sarvam API
        lang_map = {
            "ta": ("ta-IN", "Tamil"),
            "en": ("en-IN", "English"),
            "te": ("te-IN", "Telugu")
        }
        tts_lang, lang_name = lang_map.get(self.lang.lower(), ("ta-IN", "Tamil"))

        # Kavya voice is optimized for South Indian regional content (e.g. Tamil)
        tts = SarvamTTSService(
            api_key=sarvam_api_key,
            sample_rate=16000,
            settings=SarvamTTSService.Settings(
                model="bulbul:v3",
                voice="kavya",
                language=tts_lang,
                pace=1.5,
                temperature=0.7
            )
        )

        # 5. Setup Gemini LLM Service
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            logger.error("GEMINI_API_KEY is not set. Gemini LLM will fail.")

        # Check vendor approval status dynamically
        is_vendor_approved = True
        if self.mode == "vendor" and self.user_id:
            try:
                from src.services.supabase_client import get_supabase_client
                sb_client = get_supabase_client()
                shop_res = sb_client.table("shops").select("is_approved").eq("owner_id", self.user_id).execute()
                if shop_res.data:
                    is_vendor_approved = shop_res.data[0].get("is_approved", False)
                else:
                    prof_res = sb_client.table("profiles").select("is_approved").eq("id", self.user_id).execute()
                    if prof_res.data:
                        is_vendor_approved = prof_res.data[0].get("is_approved", False)
                    else:
                        is_vendor_approved = False
            except Exception as e:
                logger.error(f"Error checking vendor approval status in voice agent: {e}")
                is_vendor_approved = False

        # Base/common instructions for both customer and vendor agents
        BASE_INSTRUCTION = (
            "You are Innaikku AI, a smart, regional shopping advisor and local assistant in Hosur.\n\n"
            "PERSONA & TONAL GUIDELINES:\n"
            "- Speak naturally, casually, and warmly. You are not a robot, and you do not have to strictly enforce dry rules. Chat like a close friend helping out.\n"
            "- Act like a knowledgeable, warm local advisor. Don't just list facts—analyze, compare, give clear reasoning, and offer helpful recommendations as if you were helping a friend or local shop owner.\n"
            "- If multiple vendors have offers on the same item (e.g., mixies), automatically compare them (price, discount percentage, value) and explain human-like reasoning on which option is better and why.\n"
            "- Keep voice responses highly conversational, friendly, and brief (2-3 natural sentences).\n\n"
            "KNOWLEDGE SOURCES & GROUNDING RULES:\n"
            "1. LOCAL DATABASE DATA (Strict Grounding): All information regarding local Hosur vendors, shop profiles, products, catalog items, discount offers, prices, and customer wishlists MUST come strictly from database tool calls. If database tools return no results for a local offer or shop query, say: 'I couldn't find any details in our local database.'\n"
            "2. GENERAL KNOWLEDGE & REAL-TIME INFO: For general, non-shop queries—such as today's date/day, weather, general facts, or explanatory questions (e.g., 'How does an electric mixie work?')—use your general knowledge to give clear, helpful answers.\n"
            "3. NATURAL LANGUAGE: NEVER mention technical terms like database, SQL, primary key, UUID, table, or rows in your spoken output.\n"
            "4. LANGUAGE & NATIVE SCRIPT: Automatically detect the user's language (English, Tamil, or Telugu). "
            "Respond strictly in that language using its NATIVE script (Tamil script for Tamil, Telugu script for Telugu, English for English). Never use English letters/transliteration for Tamil or Telugu.\n"
            "Keep the answers short, warm, and crisp.\n"
            "5. LANGUAGE CONSISTENCY: Do not switch languages mid-conversation unless the user switches first."
        )

        if self.mode == "vendor":
            system_instruction = (
            f"{BASE_INSTRUCTION}\n\n"
            "ROLE: VENDOR BUSINESS ADVISOR\n"
            "You advise Hosur shop owners on managing their catalog, pricing strategies, and local discount offers in a warm, welcoming, and friendly manner.\n"
            "Available Tools: 'query_supabase_data', 'add_item', 'remove_item', 'add_offer', 'remove_offer', 'update_shop_details'.\n\n"
            "ADVISORY & WORKFLOW RULES:\n"
            "1. Active Insights: When retrieving inventory or deal data, provide actionable business advice (e.g., 'A 15% discount on mixer-grinders is trending in town, so setting a flash offer could bring in more buyers').\n"
            "2. Price & Category Check for New Products: When the vendor requests to add a new product (e.g., 'Add a Mixer to my shop'), you MUST check if they provided the base price. If the price is missing, you MUST NOT call the 'add_item' tool yet; instead, ask them warmly and friendly: 'Sure! What price would you like to set for the Mixer?' or similar. Also ask for the category (Electronics, Groceries, Home Appliances, Clothing) if they didn't state it, suggesting a reasonable default.\n"
            "3. Discount Percentage Check for Offers: When the vendor requests to create a discount offer (e.g., 'Put a discount on my Mixie'), you MUST check if they specified the discount percentage (e.g., 10% or 15%). If missing, you MUST NOT call the 'add_offer' tool yet; instead, ask them in a friendly, conversational way: 'Got it! What discount percentage would you like to offer on the Mixie today?'\n"
            "4. Shop Details Update: Before calling 'update_shop_details', clarify any missing profile information with the vendor first.\n"
            "5. Tone & Success Feedback: When any tool execution succeeds (like adding a product), respond with high warmth and friendly confirmation (e.g., 'Awesome! I have successfully added the Mixer to your catalog for you!')."
            )
            if not is_vendor_approved:
                system_instruction += (
                    "\nCRITICAL STATUS NOTICE:\n"
                    "The current vendor shop is PENDING admin approval. Warning: Catalog modification (adding/removing products) and discount offer creation are LOCKED. If the user tries to add an item, create an offer, delete items, or update shop details, you MUST politely explain that their store registration is pending approval by the admin, and these actions are disabled until approval is complete."
                )
        else:
            system_instruction = (
            f"{BASE_INSTRUCTION}\n\n"
            "ROLE: CUSTOMER SHOPPING ADVISOR\n"
            "You help Hosur residents discover the best local deals, make smart purchasing choices, understand products, and curate their wishlist in a relaxed, friendly, and non-robotic tone.\n"
            "Available Tools: 'query_supabase_data', 'add_to_wishlist', 'remove_from_wishlist'.\n\n"
            "ADVISORY & WORKFLOW RULES:\n"
            "1. Deal Comparison & Human Reasoning: When a user asks about local products or deals (e.g., 'Compare mixie deals in Hosur'), search local offers. Compare them on savings and features, giving a reasoned pick (e.g., 'Shop A offers 20% off which saves you more cash, but Shop B gives 15% off with an extra warranty jar—so Shop B might be better if you want long-term peace of mind!').\n"
            "2. General Product Questions: If the customer asks how a product works or what features to look for, explain naturally using general knowledge before suggesting available local deals.\n"
            "3. Wishlist Management: Call 'add_to_wishlist' or 'remove_from_wishlist' as requested. Explain that customers can only add items that are sold by registered local partner vendors in our catalog."
        )

        llm = GoogleLLMService(
            api_key=gemini_api_key,
            settings=GoogleLLMService.Settings(
                model="gemini-3.1-flash-lite",
                system_instruction=system_instruction
            )
        )

        # 6. Wrapper for Supabase search callback to report tool status to frontend
        async def supabase_tool_wrapper(params: FunctionCallParams):
            try:
                await self.websocket.send_json({
                    "event": "tool_calling",
                    "tool": params.function_name,
                    "args": params.arguments
                })
            except Exception as e:
                logger.error(f"Error sending tool calling event: {e}")
            await query_supabase_data(params)

        llm.register_function("query_supabase_data", supabase_tool_wrapper)

        # Define the add_to_wishlist tool wrapper
        async def add_to_wishlist_wrapper(params: FunctionCallParams):
            try:
                item_name = params.arguments.get("item_name")
                
                # Notify frontend of tool invocation
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "add_to_wishlist",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first to add items to your wishlist."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return

                # 1. Look up the item in the catalog (items table) to see if some vendor has it
                catalog_response = supabase_client.table("items").select("*, shops(name)").ilike("name", f"%{item_name}%").execute()
                items_found = catalog_response.data
                
                if not items_found:
                    result = f"Error: No local vendors sell '{item_name}'. You can only request items that exist in our shops' listings."
                    await params.result_callback(result)
                    return
                
                # Select the first matching item
                matched_item = items_found[0]
                matched_item_id = matched_item["id"]
                matched_item_name = matched_item["name"]
                shop_name = matched_item.get("shops", {}).get("name", "Local Shop")
                
                # 2. Add to wishlist
                insert_data = {
                    "customer_id": self.user_id,
                    "item_id": matched_item_id
                }
                
                # Perform insert
                wish_response = supabase_client.table("wishlists").insert(insert_data).execute()
                
                if wish_response.data:
                    result = f"Success: Added '{matched_item_name}' (sold by {shop_name}) to your wishlist."
                    # Emit websocket event so frontend can reload wishlist immediately
                    try:
                        await self.websocket.send_json({
                            "event": "wishlist_updated",
                            "item": wish_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending wishlist_updated notification: {e}")
                else:
                    result = f"Failed to add '{matched_item_name}' to wishlist."
                
                await params.result_callback(result)
            except Exception as e:
                err_str = str(e)
                if "duplicate key" in err_str or "violates unique constraint" in err_str:
                    result = f"Item '{item_name}' is already in your wishlist."
                else:
                    result = f"Error adding item to wishlist: {err_str}"
                logger.error(result)
                await params.result_callback(result)

        # Define the remove_from_wishlist tool wrapper
        async def remove_from_wishlist_wrapper(params: FunctionCallParams):
            try:
                item_name = params.arguments.get("item_name")
                
                # Notify frontend of tool invocation
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "remove_from_wishlist",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first to manage your wishlist."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return

                # Find matching wishlist entry for this user
                wishlist_response = supabase_client.table("wishlists") \
                    .select("id, item_id, items!inner(name)") \
                    .eq("customer_id", self.user_id) \
                    .ilike("items.name", f"%{item_name}%") \
                    .execute()
                
                if not wishlist_response.data:
                    result = f"Error: You do not have '{item_name}' in your wishlist."
                    await params.result_callback(result)
                    return
                
                matched_entry = wishlist_response.data[0]
                wishlist_id = matched_entry["id"]
                real_item_name = matched_entry.get("items", {}).get("name", item_name)
                
                delete_response = supabase_client.table("wishlists") \
                    .delete() \
                    .eq("id", wishlist_id) \
                    .execute()
                
                if delete_response.data:
                    result = f"Success: Removed '{real_item_name}' from your wishlist."
                    try:
                        await self.websocket.send_json({
                            "event": "wishlist_updated",
                            "action": "remove",
                            "item": delete_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending wishlist_updated notification: {e}")
                else:
                    result = f"Failed to remove '{real_item_name}' from your wishlist."
                
                await params.result_callback(result)
            except Exception as e:
                result = f"Error removing item from wishlist: {str(e)}"
                logger.error(result)
                await params.result_callback(result)

        # Define the add_item tool wrapper
        async def add_item_wrapper(params: FunctionCallParams):
            try:
                name = params.arguments.get("name")
                category = params.arguments.get("category")
                price = params.arguments.get("price")
                
                # Notify frontend of tool invocation
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "add_item",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first to add items."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return

                # 1. Fetch vendor's shop
                shop_response = supabase_client.table("shops").select("id, is_approved").eq("owner_id", self.user_id).execute()
                if not shop_response.data:
                    result = "Error: You do not have a shop registered."
                    await params.result_callback(result)
                    return
                
                shop_data = shop_response.data[0]
                if not shop_data.get("is_approved", False):
                    result = "Error: Your shop is currently pending admin approval. You cannot add products until approved."
                    await params.result_callback(result)
                    return
                
                shop_id = shop_data["id"]
                
                # 2. Insert item
                insert_response = supabase_client.table("items").insert({
                    "shop_id": shop_id,
                    "name": name,
                    "category": category,
                    "price": float(price)
                }).execute()
                
                if insert_response.data:
                    result = f"Success: Added item '{name}' to your shop catalog with price ₹{price}."
                    # Emit websocket event so frontend can reload catalog/inventory immediately
                    try:
                        await self.websocket.send_json({
                            "event": "catalog_updated",
                            "item": insert_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending catalog_updated notification: {e}")
                else:
                    result = f"Failed to add item '{name}' to catalog."
                
                await params.result_callback(result)
            except Exception as e:
                result = f"Error adding item: {str(e)}"
                logger.error(result)
                await params.result_callback(result)

        # Define the add_offer tool wrapper
        async def add_offer_wrapper(params: FunctionCallParams):
            try:
                item_name = params.arguments.get("item_name")
                discount_pct = float(params.arguments.get("discount_pct"))
                start_time_str = params.arguments.get("start_time", "today").lower().strip()
                description = params.arguments.get("description", "")
                
                # Notify frontend of tool invocation
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "add_offer",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first to add offers."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return
                from datetime import datetime, timedelta, timezone as dt_timezone
                
                # Resolve start_time naturally
                now_dt = datetime.now(dt_timezone.utc)
                start_dt = now_dt
                
                if "tomorrow" in start_time_str:
                    start_dt = now_dt + timedelta(days=1)
                    if "10" in start_time_str:
                        start_dt = start_dt.replace(hour=10, minute=0, second=0, microsecond=0)
                    elif "5" in start_time_str:
                        start_dt = start_dt.replace(hour=17, minute=0, second=0, microsecond=0)
                elif "day after" in start_time_str:
                    start_dt = now_dt + timedelta(days=2)
                elif "next week" in start_time_str:
                    start_dt = now_dt + timedelta(days=7)
                
                # Calculate end time (24 hours after start time)
                end_dt = start_dt + timedelta(hours=24)
                
                start_time_iso = start_dt.isoformat()
                end_time_iso = end_dt.isoformat()

                # 1. Fetch vendor's shop
                shop_response = supabase_client.table("shops").select("id, is_approved").eq("owner_id", self.user_id).execute()
                if not shop_response.data:
                    result = "Error: You do not have a shop registered."
                    await params.result_callback(result)
                    return
                
                shop_data = shop_response.data[0]
                if not shop_data.get("is_approved", False):
                    result = "Error: Your shop is currently pending admin approval. You cannot add promotions or discount offers until approved."
                    await params.result_callback(result)
                    return
                
                shop_id = shop_data["id"]
                
                # 2. Look up the item in the vendor's catalog to find its ID and base price
                item_response = supabase_client.table("items").select("*").eq("shop_id", shop_id).ilike("name", f"%{item_name}%").execute()
                if not item_response.data:
                    result = f"Error: Product '{item_name}' was not found in your shop catalog. You must add the product to your shop catalog first."
                    await params.result_callback(result)
                    return
                
                matched_item = item_response.data[0]
                item_id = matched_item["id"]
                base_price = float(matched_item["price"])
                
                # 3. Calculate sale price
                sale_price = base_price * (1.0 - (discount_pct / 100.0))
                
                # 4. Insert or update offer
                offer_data = {
                    "item_id": item_id,
                    "discount_pct": discount_pct,
                    "sale_price": round(sale_price, 2),
                    "description": description,
                    "start_time": start_time_iso,
                    "end_time": end_time_iso
                }
                
                upsert_response = supabase_client.table("offers").upsert(offer_data, on_conflict="item_id").execute()
                
                if upsert_response.data:
                    status_lbl = "Live" if (now_dt >= start_dt and now_dt <= end_dt) else "Upcoming"
                    result = f"Success: Created 24-hour {discount_pct}% discount offer on '{matched_item['name']}'. Sale price is ₹{round(sale_price, 2)}. Offer status is {status_lbl}."
                    # Emit websocket event so frontend can reload offers immediately
                    try:
                        await self.websocket.send_json({
                            "event": "offer_updated",
                            "item": upsert_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending offer_updated notification: {e}")
                else:
                    result = f"Failed to create offer for '{matched_item['name']}'."
                
                await params.result_callback(result)
            except Exception as e:
                result = f"Error creating offer: {str(e)}"
                logger.error(result)
                await params.result_callback(result)

        # Define the update_shop_details tool wrapper
        async def update_shop_details_wrapper(params: FunctionCallParams):
            try:
                name = params.arguments.get("name")
                owner_name = params.arguments.get("owner_name")
                location = params.arguments.get("location")
                
                # Notify frontend of tool invocation
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "update_shop_details",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return

                # Build update payload
                update_data = {}
                if name:
                    update_data["name"] = name
                if owner_name:
                    update_data["owner_name"] = owner_name
                if location:
                    update_data["location"] = location
                
                if not update_data:
                    result = "Error: No shop details were specified to update. Please state what you want to change (name, owner name, or location)."
                    await params.result_callback(result)
                    return

                # Fetch vendor's shop to check approval status
                shop_response = supabase_client.table("shops").select("id, is_approved").eq("owner_id", self.user_id).execute()
                if not shop_response.data:
                    result = "Error: You do not have a shop registered."
                    await params.result_callback(result)
                    return
                
                shop_data = shop_response.data[0]
                if not shop_data.get("is_approved", False):
                    result = "Error: Your shop is currently pending admin approval. You cannot update shop details until approved."
                    await params.result_callback(result)
                    return

                # Update shop details
                update_response = supabase_client.table("shops") \
                    .update(update_data) \
                    .eq("owner_id", self.user_id) \
                    .execute()
                
                if update_response.data:
                    result = f"Success: Updated your shop details. New details: {update_data}."
                    try:
                        await self.websocket.send_json({
                            "event": "shop_updated",
                            "item": update_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending shop_updated notification: {e}")
                else:
                    result = "Error: No shop found registered to your profile, so I couldn't update the details."
                
                await params.result_callback(result)
            except Exception as e:
                result = f"Error updating shop details: {str(e)}"
                logger.error(result)
                await params.result_callback(result)

        # Define the remove_item tool wrapper
        async def remove_item_wrapper(params: FunctionCallParams):
            try:
                name = params.arguments.get("name")
                
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "remove_item",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return

                shop_response = supabase_client.table("shops").select("id, is_approved").eq("owner_id", self.user_id).execute()
                if not shop_response.data:
                    result = "Error: You do not have a shop registered."
                    await params.result_callback(result)
                    return
                
                shop_data = shop_response.data[0]
                if not shop_data.get("is_approved", False):
                    result = "Error: Your shop is currently pending admin approval. You cannot remove catalog items until approved."
                    await params.result_callback(result)
                    return
                
                shop_id = shop_data["id"]
                
                item_response = supabase_client.table("items") \
                    .select("id, name") \
                    .eq("shop_id", shop_id) \
                    .ilike("name", f"%{name}%") \
                    .execute()
                
                if not item_response.data:
                    result = f"Error: Product '{name}' was not found in your shop catalog."
                    await params.result_callback(result)
                    return
                
                matched_item = item_response.data[0]
                item_id = matched_item["id"]
                item_name_full = matched_item["name"]
                
                delete_response = supabase_client.table("items") \
                    .delete() \
                    .eq("id", item_id) \
                    .execute()
                
                if delete_response.data:
                    result = f"Success: Removed '{item_name_full}' from your shop catalog."
                    try:
                        await self.websocket.send_json({
                            "event": "catalog_updated",
                            "action": "remove",
                            "item": delete_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending catalog_updated notification: {e}")
                else:
                    result = f"Failed to remove '{item_name_full}' from your catalog."
                
                await params.result_callback(result)
            except Exception as e:
                result = f"Error removing item from catalog: {str(e)}"
                logger.error(result)
                await params.result_callback(result)

        # Define the remove_offer tool wrapper
        async def remove_offer_wrapper(params: FunctionCallParams):
            try:
                item_name = params.arguments.get("item_name")
                
                try:
                    await self.websocket.send_json({
                        "event": "tool_calling",
                        "tool": "remove_offer",
                        "args": params.arguments
                    })
                except Exception as e:
                    logger.error(f"Error sending tool calling event: {e}")
                
                if not self.user_id:
                    result = "Error: You are not logged in. Please log in first."
                    await params.result_callback(result)
                    return

                from src.services.supabase_client import get_supabase_client
                try:
                    supabase_client = get_supabase_client()
                except Exception as e:
                    result = f"Error: Supabase client is not initialized. Details: {e}"
                    await params.result_callback(result)
                    return

                shop_response = supabase_client.table("shops").select("id, is_approved").eq("owner_id", self.user_id).execute()
                if not shop_response.data:
                    result = "Error: You do not have a shop registered."
                    await params.result_callback(result)
                    return
                
                shop_data = shop_response.data[0]
                if not shop_data.get("is_approved", False):
                    result = "Error: Your shop is currently pending admin approval. You cannot remove discount offers until approved."
                    await params.result_callback(result)
                    return
                
                shop_id = shop_data["id"]
                
                item_response = supabase_client.table("items") \
                    .select("id, name") \
                    .eq("shop_id", shop_id) \
                    .ilike("name", f"%{item_name}%") \
                    .execute()
                
                if not item_response.data:
                    result = f"Error: Product '{item_name}' was not found in your shop catalog."
                    await params.result_callback(result)
                    return
                
                matched_item = item_response.data[0]
                item_id = matched_item["id"]
                item_name_full = matched_item["name"]
                
                delete_response = supabase_client.table("offers") \
                    .delete() \
                    .eq("item_id", item_id) \
                    .execute()
                
                if delete_response.data:
                    result = f"Success: Removed offer for '{item_name_full}'."
                    try:
                        await self.websocket.send_json({
                            "event": "offer_updated",
                            "action": "remove",
                            "item": delete_response.data[0]
                        })
                    except Exception as e:
                        logger.error(f"Error sending offer_updated notification: {e}")
                else:
                    result = f"Error: No active offer found for '{item_name_full}'."
                
                await params.result_callback(result)
            except Exception as e:
                result = f"Error removing offer: {str(e)}"
                logger.error(result)
                await params.result_callback(result)

        # Register wrappers to Gemini LLM based on mode
        if self.mode == "vendor":
            llm.register_function("add_item", add_item_wrapper)
            llm.register_function("remove_item", remove_item_wrapper)
            llm.register_function("add_offer", add_offer_wrapper)
            llm.register_function("remove_offer", remove_offer_wrapper)
            llm.register_function("update_shop_details", update_shop_details_wrapper)
            tools = ToolsSchema(standard_tools=[
                supabase_query_schema,
                add_item_schema,
                remove_item_schema,
                add_offer_schema,
                remove_offer_schema,
                update_shop_details_schema
            ])
        else:
            llm.register_function("add_to_wishlist", add_to_wishlist_wrapper)
            llm.register_function("remove_from_wishlist", remove_from_wishlist_wrapper)
            tools = ToolsSchema(standard_tools=[
                supabase_query_schema,
                add_to_wishlist_schema,
                remove_from_wishlist_schema
            ])

        # 7. Setup Context and Aggregators
        context = LLMContext(messages=[], tools=tools)

        user_aggregator, assistant_aggregator = LLMContextAggregatorPair(context)

        # 8. Assemble the Pipeline with status senders
        user_status_sender = WebSocketStatusSender(self.websocket)
        bot_status_sender = WebSocketStatusSender(self.websocket)
        
        # Instantiate language detector processor
        lang_detector = LanguageDetectorProcessor(tts)
        
        # Instantiate STT ordering processor to align VAD and STT events
        stt_ordering = STTOrderingProcessor()
        
        pipeline = Pipeline([
            transport.input(),        # Receives client audio
            stt,                      # Audio -> TranscriptionFrame
            stt_ordering,             # Reorders VAD events so transcription arrives before prompt trigger
            user_status_sender,       # Sends user_transcription event to client
            user_aggregator,          # user history
            llm,                      # Gemini -> TextFrame/Tool calls
            bot_status_sender,        # Sends bot_transcription event to client
            lang_detector,            # Intercepts bot text and updates TTS language setting dynamically
            tts,                      # Text -> Audio
            transport.output(),       # Output raw audio bytes to client
            assistant_aggregator      # assistant history (aggregates at the end of the pipeline)
        ])

        # 9. Execute Pipeline Task
        task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=False))

        @transport.event_handler("on_client_connected")
        async def on_client_connected(transport, websocket):
            logger.info("Voice connection active: client connected to WebSocket.")

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, websocket):
            logger.info("Voice connection ended: client disconnected.")

        # Run task
        runner = PipelineRunner()
        try:
            logger.info("Starting Pipecat pipeline task...")
            await runner.run(task)
            logger.info("Pipecat pipeline task execution finished.")
        except Exception as e:
            logger.error(f"Exception in pipeline task execution: {e}")

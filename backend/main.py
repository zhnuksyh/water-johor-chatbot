from fastapi import FastAPI, UploadFile, File, HTTPException
# Trigger reload for model upgrade
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import List, Optional
import os
import time
import subprocess
import shutil
from pathlib import Path

# AI Libraries (Try/Except for graceful fallback if not installed/models missing)
try:
    from llama_cpp import Llama
    HAS_LLAMA = True
except ImportError:
    HAS_LLAMA = False
    print("Warning: llama-cpp-python not found.")

try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False
    print("Warning: faster-whisper not found.")

app = FastAPI(title="Aqua Local Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MODELS_DIR = Path("models")
LLM_PATH = MODELS_DIR / "llm" / "model.gguf"
STT_MODEL_SIZE = "distil-medium.en" # or "base.en"
PIPER_DIR = MODELS_DIR / "tts" / "piper"
PIPER_DIR = MODELS_DIR / "tts" / "piper"
PIPER_VOICE = MODELS_DIR / "tts" / "en_US-ryan-medium.onnx"

# --- Global Model Instances ---
llm_model = None
stt_model = None

# System Persona
# System Persona (Optimized for Small Models)
SYSTEM_PROMPT = """You are Aqua, the support agent for Ranhill SAJ (Water Utility Company).
YOUR JOB: Answer questions about WATER SERVICES only (water bills, leaks, new connections, meter reading).

CRITICAL RULES (FOLLOW STRICTLY):
1. IGNORE non-water topics. If asked about electricity, food, or general knowledge, say "I only handle water services."
2. "BILL" ALWAYS MEANS "WATER BILL". Do not ask which bill. Assume it is the Ranhill SAJ water bill.
3. BE CONCISE. Maximum 2-3 sentences.
4. USE LISTS. Use bullet points for steps.
5. IF USER CONTEXT IS PROVIDED, USE IT.

COMPANY INFO:
- Hotline: 1-800-88-7474
- Payment: JomPAY (5132), SAJ App, 7-Eleven.
- Tariff: <20m3: RM0.60 | 20-35m3: RM1.10 | >35m3: RM2.00.

Troubleshooting:
- High Bill? Check for leaks (toilet tank).
- No Water? Check main valve.

Respond in a helpful, professional Malaysian tone."""

# Mock User Database (Serial Number -> Data)
MOCK_USER_DATABASE = {
    "123456": {
        "name": "Ali bin Abu",
        "address": "No 12, Jalan Ria 2, Taman Molek, 81100 JB",
        "account_no": "SAJ882190",
        "last_bill_amount": "RM45.50",
        "last_bill_date": "01 Jan 2026",
        "billing_status": "Unpaid",
        "last_payment": "RM40.00 on 10 Dec 2025",
        "average_usage": "35 m³",
        "usage_trend": "Stable (Oct: 34m³, Nov: 35m³, Dec: 35m³)",
        "estimated_breakdown": "Normal household usage (Indoor: 90%, Outdoor: 10%)",
        "status": "Active"
    },
    "789012": {
        "name": "Siti binti Ahmad",
        "address": "45, Jalan Merdeka, Skudai, 81300 JB",
        "account_no": "SAJ110293",
        "last_bill_amount": "RM120.00",
        "last_bill_date": "01 Jan 2026",
        "billing_status": "Unpaid",
        "last_payment": "RM50.00 on 15 Nov 2025",
        "average_usage": "60 m³",
        "usage_trend": "Increasing Spike (Oct: 35m³, Nov: 45m³, Dec: 60m³)",
        "estimated_breakdown": "High Outdoor Usage detected (Indoor: 40%, Outdoor: 60%)",
        "status": "High Usage Alert (Possible Leak)"
    }
}

# Report Mode System Prompt
REPORT_MODE_SYSTEM_PROMPT = """You are Aqua from Ranhill SAJ (Air Johor) in REPORT MODE. Your ONLY job is to collect information about a water problem and then connect the customer to a plumber.

CRITICAL RULES:
1. DO NOT give advice, tips, or DIY solutions
2. DO NOT explain how to fix anything
3. ONLY ask short questions to gather: what the problem is, where it is, and how bad it is
4. Keep ALL responses to 1-2 sentences maximum
5. After getting basic info (problem + location), output [READY_TO_CONNECT] on its own line

INFORMATION TO GATHER:
- What is wrong? (leak, burst pipe, no water, low pressure, meter issue)
- Where is it? (kitchen, bathroom, outside, meter area, etc.)
- How bad? (drip, flowing, flooding, urgent)

EXAMPLE:
User: "there's a leaking in my kitchen"
Aqua: "I'm sorry to hear that. Is the water dripping slowly or flowing heavily?"
User: "it's dripping from under the sink"
Aqua: "Thank you. I'll connect you with a plumber now.
[READY_TO_CONNECT]"

NEVER provide repair instructions. ONLY gather info and connect to plumber."""

def load_models():
    global llm_model, stt_model
    
    # 1. Load LLM
    if HAS_LLAMA and LLM_PATH.exists():
        print(f"Loading LLM from {LLM_PATH}...")
        try:
            # Adjust n_gpu_layers for GPU acceleration if available, n_ctx for context window
            llm_model = Llama(model_path=str(LLM_PATH), n_ctx=4096, n_gpu_layers=-1, verbose=False)
            print("LLM Loaded.")
        except Exception as e:
            print(f"Failed to load LLM: {e}")
    else:
        print("LLM model not found or library missing. Using Mock.")

    # 2. Load STT
    if HAS_WHISPER:
        print(f"Loading Whisper ({STT_MODEL_SIZE})...")
        try:
            # device="cpu" or "cuda"
            stt_model = WhisperModel(STT_MODEL_SIZE, device="cpu", compute_type="int8")
            print("Whisper Loaded.")
        except Exception as e:
            print(f"Failed to load Whisper: {e}")

@app.on_event("startup")
async def startup_event():
    load_models()

# --- Data Models ---
class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "local-model"
    mode: Optional[str] = "normal"  # "normal" or "report"
    serial_number: Optional[str] = None

class TTSRequest(BaseModel):
    input: str
    voice: Optional[str] = "en_US-amy-medium"

# --- Endpoints ---

@app.get("/health")
async def health_check():
    status = {
        "status": "ok",
        "llm": bool(llm_model),
        "stt": bool(stt_model),
        "tts": PIPER_VOICE.exists()
    }
    return status

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    print(f"Chat Request ({request.mode}): {request.messages[-1].content[:50]}...")

    # Select system prompt based on mode
    base_system_prompt = REPORT_MODE_SYSTEM_PROMPT if request.mode == "report" else SYSTEM_PROMPT

    # Inject User Context if Serial Number provided
    user_context = ""
    if request.serial_number and request.serial_number in MOCK_USER_DATABASE:
        user_data = MOCK_USER_DATABASE[request.serial_number]
        user_context = f"\n\n[OFFICIAL USER DATA - USE THIS FOR ANSWERS]\n" \
                       f"NAME: {user_data['name']}\n" \
                       f"ACC NO: {user_data['account_no']}\n" \
                       f"LAST BILL: {user_data['last_bill_amount']} ({user_data['billing_status']})\n" \
                       f"USAGE TREND (3 MO): {user_data['usage_trend']}\n" \
                       f"EST. BREAKDOWN: {user_data['estimated_breakdown']}\n" \
                       f"STATUS: {user_data['status']}\n\n" \
                       f"INSTRUCTIONS FOR DATA:\n" \
                       f"1. Explain 'Why High Bill' using TREND and BREAKDOWN. (e.g., 'Your usage spiked due to {user_data['estimated_breakdown']}').\n" \
                       f"2. Suggest tips based on BREAKDOWN.\n" \
                       f"3. Do NOT cite generic reasons if you have this data."

    final_system_prompt = base_system_prompt + user_context

    if llm_model:
        # Construct Prompt (Llama-3 Chat Format or generic)
        # Simple format: System + User/Assistant history
        prompt_messages = [{"role": "system", "content": final_system_prompt}]

        # Convert messages and add mode context for report mode
        for m in request.messages:
            msg = m.dict()
            # For report mode, reinforce the context in the last user message
            if request.mode == "report" and m == request.messages[-1] and msg["role"] == "user":
                msg["content"] = f"[REPORT MODE - Only ask questions to gather info, do NOT give advice] {msg['content']}"
            prompt_messages.append(msg)
        
        try:
            output = llm_model.create_chat_completion(
                messages=prompt_messages,
                max_tokens=256,
                temperature=0.7
            )
            return output
        except Exception as e:
            print(f"Inference Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    else:
        # Fallback Mock (Enhanced for Testing Data Injection)
        time.sleep(0.5)
        mock_response = "[MOCK] I am Aqua (Backend LLM not loaded). How can I help?"
        
        if request.serial_number and request.serial_number in MOCK_USER_DATABASE:
            u = MOCK_USER_DATABASE[request.serial_number]
            last_msg = request.messages[-1].content.lower()
            if "bill" in last_msg or "high" in last_msg:
                mock_response = f"[MOCK DATA RESPONSE] Based on your data, in the last 2 months, you have used significant amount of water. Status: {u['status']}. Trend: {u['usage_trend']}."
            elif "usage" in last_msg:
                mock_response = f"[MOCK DATA RESPONSE] In the past 3 months, your usage was: {u['usage_trend']}."
            elif "save" in last_msg:
                 mock_response = f"[MOCK DATA RESPONSE] Based on your usage ({u['estimated_breakdown']}), you could save water by optimizing outdoor usage."
            else:
                 mock_response = f"[MOCK DATA RESPONSE] Verified user {u['name']}. How can I assist with your account?"

        if request.mode == "report":
            mock_response = "[MOCK] I understand you have a water issue. Can you describe what's happening?\n[READY_TO_CONNECT]"
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": mock_response
                }
            }]
        }

@app.post("/v1/audio/transcriptions")
async def transcribe_audio(file: UploadFile = File(...)):
    print(f"STT Request: {file.filename}")
    
    if not stt_model:
        return {"text": "[MOCK] Backend STT not loaded."}
    
    # Save temp file
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        segments, info = stt_model.transcribe(temp_filename, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        return {"text": text.strip()}
    except Exception as e:
        print(f"STT Error: {e}")
        return {"text": "Error processing audio."}
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

@app.post("/v1/audio/speech")
async def synthesize_speech(request: TTSRequest):
    print(f"TTS Request: {request.input[:50]}...")
    
    piper_exec = PIPER_DIR / "piper"
    if not piper_exec.exists() or not PIPER_VOICE.exists():
        print("Piper not found.")
        # Return a dummy wav or error
        # For prototype, we'll return 404 so frontend knows
        raise HTTPException(status_code=501, detail="Piper TTS not installed/configured.")

    try:
        # echo "text" | ./piper --model ... --output_file output.wav
        cmd = [
            str(piper_exec),
            "--model", str(PIPER_VOICE),
            "--output_file", "-"  # Output to stdout
        ]
        
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        stdout, stderr = process.communicate(input=request.input.encode("utf-8"))
        
        if process.returncode != 0:
            print(f"Piper Error: {stderr.decode()}")
            raise Exception("Piper synthesis failed")
            
        return Response(content=stdout, media_type="audio/wav")
        
    except Exception as e:
        print(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

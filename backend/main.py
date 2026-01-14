from fastapi import FastAPI, UploadFile, File, HTTPException
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
PIPER_VOICE = MODELS_DIR / "tts" / "en_US-amy-medium.onnx"

# --- Global Model Instances ---
llm_model = None
stt_model = None

# System Persona
SYSTEM_PROMPT = """You are Aqua, the official virtual assistant for Water Johor (a water utility provider). 
You assist customers with bill payments, water disruption alerts, new account applications, and reporting pipe leaks. 
You are polite, concise, and professional. 
Always answer as Aqua. Keep responses under 3 sentences unless asked for details."""

def load_models():
    global llm_model, stt_model
    
    # 1. Load LLM
    if HAS_LLAMA and LLM_PATH.exists():
        print(f"Loading LLM from {LLM_PATH}...")
        try:
            # Adjust n_gpu_layers for GPU acceleration if available, n_ctx for context window
            llm_model = Llama(model_path=str(LLM_PATH), n_ctx=2048, n_gpu_layers=-1, verbose=False)
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
    print(f"Chat Request: {request.messages[-1].content[:50]}...")
    
    if llm_model:
        # Construct Prompt (Llama-3 Chat Format or generic)
        # Simple format: System + User/Assistant history
        prompt_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        prompt_messages.extend([m.dict() for m in request.messages])
        
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
        # Fallback Mock
        time.sleep(0.5)
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "[MOCK] I am Aqua (Backend LLM not loaded). How can I help?"
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

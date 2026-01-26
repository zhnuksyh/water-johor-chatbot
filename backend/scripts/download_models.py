import os
import requests
import tarfile
import zipfile
from pathlib import Path

# Configuration
MODELS_DIR = Path("models")
LLM_DIR = MODELS_DIR / "llm"
STT_DIR = MODELS_DIR / "stt"
TTS_DIR = MODELS_DIR / "tts"

# URLs
# Swapping to Llama-3-8B-Instruct for better reasoning/logic constraints
LLM_URL = "https://huggingface.co/bartowski/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"
LLM_FILENAME = "model.gguf"

# Piper (Linux x86_64)
PIPER_URL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
VOICE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx"
VOICE_CONFIG_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json"

def download_file(url, dest_path):
    if dest_path.exists():
        print(f"File exists: {dest_path}. Overwriting for model upgrade...")
        # return  <-- Commented out to force overwrite for upgrade
    
    print(f"Downloading {url}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded to {dest_path}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

def setup_directories():
    for d in [LLM_DIR, STT_DIR, TTS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    print("Directories created.")

def main():
    setup_directories()

    # 1. Download LLM
    print("\n--- Model: LLM ---")
    download_file(LLM_URL, LLM_DIR / LLM_FILENAME)

    # 2. STT (Whisper)
    # faster-whisper downloads automatically on first run, 
    # but we can pre-download if we wanted to. 
    # For now, we'll let it handle itself or valid via a dummy run.
    print("\n--- Model: STT (Whisper) ---")
    print("Faster-Whisper will auto-download 'distil-medium.en' on first run.")

    # 3. TTS (Piper)
    print("\n--- Model: TTS (Piper) ---")
    piper_tar_path = TTS_DIR / "piper.tar.gz"
    download_file(PIPER_URL, piper_tar_path)
    
    if piper_tar_path.exists() and not (TTS_DIR / "piper").exists():
        print("Extracting Piper...")
        with tarfile.open(piper_tar_path, "r:gz") as tar:
            tar.extractall(path=TTS_DIR)
        print("Piper extracted.")
    
    # Download Voice
    download_file(VOICE_URL, TTS_DIR / "en_US-amy-medium.onnx")
    download_file(VOICE_CONFIG_URL, TTS_DIR / "en_US-amy-medium.onnx.json")

    print("\nDone! Models prepared.")

if __name__ == "__main__":
    main()

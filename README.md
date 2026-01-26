# Aqua Chatbot - AI Water Utility Assistant

Aqua is a next-generation AI assistant designed for water utility services (like Ranhill SAJ). It moves beyond simple text bots by offering **real-time speech-to-speech interaction**, **intelligent report filing**, and **direct plumber connection**.

## 🌟 Key Features

-   **🎙️ Real-time Speech-to-Speech**: Talk to Aqua naturally. No need to type. It listens, processes, and speaks back instantly with a human-like voice.
-   **🔧 Intelligent Report Mode**: A structured conversational flow to report water issues (leaks, bursts, low pressure). Aqua gathers location and severity details automatically.
-   **👷 Instant Plumber Network**: In emergencies, Aqua can simulate connecting you directly to available plumbers in your area.
-   **📱 Modern Glassmorphism UI**: A beautiful, deep-space themed interface with reactive animations and visual feedback for voice activity.
-   **🚀 Local Privacy-First AI**: Powered by local LLMs (Llama/Qwen) and STT/TTS engines for data privacy and low latency.

## 🛠️ Tech Stack

### Frontend
-   **Framework**: React 19 + Vite
-   **Styling**: Tailwind CSS 4 + Custom CSS (Glassmorphism)
-   **Icons**: Lucide React
-   **Audio**: Web Audio API (Native browser support)

### Backend
-   **Server**: FastAPI (Python)
-   **Server Config**: Uvicorn with SSL (HTTPS required for microphone access)
-   **Package Manager**: `uv` (An extremely fast Python package installer)
-   **AI Engines**:
    -   LLM: `llama-cpp-python` / `transformers`
    -   STT: `faster-whisper`
    -   TTS: Custom / System TTS

## 🚀 Getting Started

### Prerequisites
-   Node.js & npm
-   Python 3.11+
-   `uv` (Install via `curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 1. Backend Setup

The backend handles AI processing. It must run on **HTTPS** (port 5000) to allow the browser unrestricted microphone access.

```bash
cd backend
# Install dependencies
uv sync

# Run the server (Self-signed SSL certs required in backend/ directory)
./run_backend.sh
```

> **Note**: You will need `key.pem` and `cert.pem` in the `backend/` directory. You can generate them with `openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes`.

### 2. Frontend Setup

The frontend is a modern React application.

```bash
cd frontend
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open `https://localhost:5173` (or the IP shown in terminal) on your browser.

> **Mobile Testing**: To test on mobile, ensure your phone and computer are on the same Wi-Fi. Access via `https://<YOUR_PC_IP>:5173`. You may need to accept the "unsafe" self-signed certificate warning for both the frontend AND the backend (`https://<YOUR_PC_IP>:5000/docs`).

## 📂 Project Structure

```
├── backend/
│   ├── main.py            # FastAPI entry point
│   ├── models/            # Local model weights (gguf, etc.)
│   └── run_backend.sh     # Startup script
├── frontend/
│   ├── src/
│   │   ├── AquaChat.tsx   # Main Chat Interface
│   │   ├── services/      # API integration (STT, TTS, Chat)
│   │   └── components/    # UI Modals & Widgets
│   └── package.json
└── README.md
```

## 🛡️ License

Private / Internal Project.

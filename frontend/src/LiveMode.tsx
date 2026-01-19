import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Define the shape of a message as expected by the parent component
interface ChatMessage {
    role: 'user' | 'model' | 'assistant';
    text: string;
}

interface LiveModeProps {
    onClose: () => void;
    onAddMessage: (message: ChatMessage) => void;
}

const VAD_THRESHOLD = 0.012;  // Slightly increased to avoid background noise
const SILENCE_DURATION = 2000; // Longer silence required to commit (avoid chopping)

const LiveMode: React.FC<LiveModeProps> = ({ onClose, onAddMessage }) => {
    const [status, setStatus] = useState<string>('Connecting...');
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false); // User is speaking
    const [isAquaSpeaking, setIsAquaSpeaking] = useState<boolean>(false); // Aqua is speaking
    const [volume, setVolume] = useState<number>(0);

    const websocketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingRef = useRef<boolean>(false);
    const currentSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    // Initialize Connection & Audio
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const wsUrl = `${protocol}//${host}:5000/ws/live`;

        websocketRef.current = new WebSocket(wsUrl);

        websocketRef.current.onopen = () => {
            setStatus('Ready');
            startListening(); // Auto-start
        };

        websocketRef.current.onmessage = async (event: MessageEvent) => {
            // Handle Binary Audio
            if (event.data instanceof ArrayBuffer) {
                audioQueueRef.current.push(event.data);
                if (!isPlayingRef.current) {
                    playNextChunk();
                }
                return;
            }

            // Handle Text Messages
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'transcription') {
                    setStatus('Thinking...');
                    if (onAddMessage && data.text) onAddMessage({ role: 'user', text: data.text });
                } else if (data.type === 'text_response') {
                    setStatus('Speaking...');
                    setIsAquaSpeaking(true);
                    if (onAddMessage && data.text) onAddMessage({ role: 'model', text: data.text });
                } else if (data.type === 'audio_end') {
                    // We handle end via queue empty check mostly
                }
            } catch (e) {
                console.error("Error parsing WebSocket message:", e);
            }
        };

        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (websocketRef.current) websocketRef.current.close();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
        if (audioContextRef.current) audioContextRef.current.close();
        if (currentSourceNodeRef.current) currentSourceNodeRef.current.stop();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    // Playback Logic
    const playNextChunk = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsAquaSpeaking(false);
            setStatus('Listening...');
            return;
        }

        isPlayingRef.current = true;
        setIsAquaSpeaking(true);
        const chunk = audioQueueRef.current.shift();

        if (!chunk) return;

        try {
            if (!audioContextRef.current) return;

            const audioBuffer = await audioContextRef.current.decodeAudioData(chunk);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            currentSourceNodeRef.current = source;

            source.onended = () => {
                playNextChunk();
            };

            source.start();
        } catch (e) {
            console.error("Decode Error", e);
            playNextChunk();
        }
    };

    // Interrupt / Barge-in
    const interruptAqua = () => {
        if (isPlayingRef.current || audioQueueRef.current.length > 0) {
            console.log("Interrupting Aqua...");
            if (currentSourceNodeRef.current) {
                try { currentSourceNodeRef.current.stop(); } catch (e) { }
            }
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setIsAquaSpeaking(false);

            if (websocketRef.current?.readyState === WebSocket.OPEN) {
                websocketRef.current.send(JSON.stringify({ type: 'interrupt' }));
            }
        }
    };

    // VAD & Recording Logic
    const startListening = async () => {
        try {
            // 1. Setup Audio Context for VAD
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 2. Setup Analyser
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyserRef.current = analyser;
            sourceRef.current = source;

            // 3. Setup MediaRecorder for sending chunks
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN && isRecordingRef.current) {
                    websocketRef.current.send(e.data);
                }
            };

            recorder.start(100);

            // 4. Run Analysis Loop
            analyzeAudio();

        } catch (e) {
            console.error("Mic Error", e);
            setStatus("Error: No Mic");
        }
    };

    const analyzeAudio = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS (Rough volume)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVol = average / 255;

        setVolume(normalizedVol);

        // VAD Logic (Debug Log occasionally)
        if (normalizedVol > VAD_THRESHOLD) {
            // Speech Detected
            if (!isSpeaking) {
                console.log("Speech Start");
                setIsSpeaking(true);
                isRecordingRef.current = true; // Start sending chunks
                interruptAqua(); // Barge-in!
            }

            // Reset silence timer
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                // Silence Detected
                console.log("Speech End (Commit)");
                setIsSpeaking(false);
                isRecordingRef.current = false;
                if (websocketRef.current?.readyState === WebSocket.OPEN) {
                    websocketRef.current.send(JSON.stringify({ type: 'commit' }));
                }
            }, SILENCE_DURATION);
        }

        requestAnimationFrame(analyzeAudio);
    };

    const forceCommit = () => {
        if (!isSpeaking && !isRecordingRef.current) return;

        console.log("Force Commit (Manual Tap)");
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsSpeaking(false);
        isRecordingRef.current = false;

        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({ type: 'commit' }));
        }
        setStatus('Sending...');
    };

    return (
        <div className="fixed inset-0 bg-[#09090b] z-[100] flex flex-col items-center justify-center overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0c4a6e]/20 to-[#09090b] pointer-events-none" />

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-8 right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all z-50 backdrop-blur-md"
            >
                <X size={24} />
            </button>

            {/* Main Visualizer Container */}
            <div className="relative w-full max-w-md aspect-square flex items-center justify-center">

                {/* The Water Bubble - Tap to Commit */}
                <div
                    onClick={forceCommit}
                    className={`
            relative flex items-center justify-center transition-all duration-700 ease-out cursor-pointer
            ${isSpeaking ? 'scale-110' : 'scale-100'}
            ${isAquaSpeaking ? 'animate-pulse-slow' : ''}
         `}>

                    {/* Core Bubble */}
                    <div
                        className="w-64 h-64 rounded-full relative z-10 transition-all duration-100"
                        style={{
                            background: isSpeaking
                                ? 'radial-gradient(circle at 30% 30%, rgba(6,182,212,0.8), rgba(30,58,138,0.9))' // User Talking (Active Blue)
                                : isAquaSpeaking
                                    ? 'radial-gradient(circle at 70% 30%, rgba(139,92,246,0.8), rgba(76,29,149,0.9))' // Aqua Talking (Purple)
                                    : 'radial-gradient(circle at 50% 40%, rgba(6,182,212,0.4), rgba(15,23,42,0.6))', // Idle (Deep Blue)
                            boxShadow: `
                      inset -10px -10px 20px rgba(0,0,0,0.5),
                      inset 10px 10px 20px rgba(255,255,255,0.2),
                      0 0 ${30 + volume * 200}px ${isSpeaking ? 'rgba(34,211,238,0.6)' : 'rgba(34,211,238,0.2)'}
                   `,
                            transform: `scale(${1 + volume * 0.5})` // Size reacts to volume
                        }}
                    >
                        {/* Fluid Surface Effect (Pseudo-Reflections) */}
                        <div className="absolute top-[15%] left-[20%] w-[25%] h-[15%] rounded-[50%] bg-white/20 blur-[2px] rotate-[-45deg]" />
                        <div className="absolute bottom-[15%] right-[20%] w-[10%] h-[10%] rounded-full bg-cyan-400/10 blur-[10px]" />
                    </div>

                    {/* Ripple Rings (CSS Animation) */}
                    {!isSpeaking && !isAquaSpeaking && (
                        <>
                            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping-slow" />
                            <div className="absolute inset-[-20px] rounded-full border border-cyan-500/10 animate-ping-slower delay-75" />
                        </>
                    )}

                </div>

            </div>

            {/* Status Text */}
            <div className="mt-12 flex flex-col items-center gap-3 relative z-20">
                <h2 className={`
            text-2xl font-light tracking-widest transition-all duration-500
            ${isSpeaking ? 'text-cyan-300 scale-110' : isAquaSpeaking ? 'text-violet-300' : 'text-zinc-500'}
         `}>
                    {status === 'LISTENING...' ? 'LISTENING (TAP TO SEND)' : status.toUpperCase()}
                </h2>

                <div className="h-1 w-12 bg-zinc-800 rounded-full overflow-hidden mt-4">
                    <div
                        className="h-full bg-cyan-500 transition-all duration-75 ease-linear"
                        style={{ width: `${Math.min(volume * 500, 100)}%` }}
                    />
                </div>

                {/* Debug Overlay */}
                <div className="text-[10px] text-zinc-600 font-mono mt-2 flex flex-col items-center">
                    <span>Vol: {volume.toFixed(4)} | Thr: {VAD_THRESHOLD}</span>
                    <div className="w-32 h-1 bg-zinc-800 relative mt-1">
                        <div className="absolute top-0 bottom-0 bg-red-500 w-[1px]" style={{ left: `${VAD_THRESHOLD * 500}%` }} />
                        <div className="h-full bg-cyan-500" style={{ width: `${Math.min(volume * 500, 100)}%` }} />
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes pulse-slow {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.05); filter: brightness(1.2); }
        }
        @keyframes ping-slow {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes ping-slower {
            0% { transform: scale(0.8); opacity: 0.3; }
            100% { transform: scale(2); opacity: 0; }
        }
        .animate-pulse-slow { animation: pulse-slow 3s infinite ease-in-out; }
        .animate-ping-slow { animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-ping-slower { animation: ping-slower 4s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>

        </div>
    );
};

export default LiveMode;

import React, { useState, useEffect, useRef } from 'react';
import { chatCompletion, transcribeAudio, synthesizeSpeech, ChatMessage } from './services/api';
import { ReportState } from './types';
import { getUserProfile } from './services/userProfile';
import { getRandomAvailablePlumber } from './data/plumbers';
import ReportModeBanner from './components/ReportModeBanner';
import PlumberConnectionModal from './components/PlumberConnectionModal';
import ProfilePage from './ProfilePage';
import {
    Mic,
    Send,
    Plus,
    Trash2,
    Bot,
    PanelLeftOpen,
    X,
    StopCircle,
    Hammer,
    Pencil,
    Check,
    User
} from 'lucide-react';


// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
// API Key management is now handled by the backend authentication logic if needed.
// For Local AI, we don't need external keys.

// ==========================================
// STYLES & ANIMATIONS
// ==========================================
// [UI NOTE]: These styles create the "glassmorphism" and "deep space" look.
// Ensure these classes remain performant when running on lower-end local hardware.
const GlobalStyles = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600&display=swap');
    
    body {
      font-family: 'Poppins', sans-serif !important;
      background-color: #09090b; /* Zinc 950 */
    }

    /* Modern Scrollbar */
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

    .glass-panel {
      background: rgba(24, 24, 27, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-right: 1px solid rgba(255, 255, 255, 0.05);
    }

    .glass-input {
      background: rgba(39, 39, 42, 0.8);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
    }

    .glass-input.recording {
      border-color: rgba(6, 182, 212, 0.4);
      box-shadow: 0 0 30px rgba(6, 182, 212, 0.15);
    }

    /* Radio Wave Animation */
    .radio-wave-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 24px;
    }

    .radio-bar {
      width: 4px;
      background-color: #22d3ee;
      border-radius: 99px;
      animation: radio-pulse 1.2s ease-in-out infinite;
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
    }

    .radio-bar:nth-child(odd) { animation-duration: 0.8s; }
    .radio-bar:nth-child(2n) { animation-duration: 1.1s; }
    .radio-bar:nth-child(3n) { animation-duration: 1.3s; }
    .radio-bar:nth-child(1) { animation-delay: 0.0s; }
    .radio-bar:nth-child(2) { animation-delay: 0.1s; }
    .radio-bar:nth-child(3) { animation-delay: 0.2s; }
    .radio-bar:nth-child(4) { animation-delay: 0.1s; }
    .radio-bar:nth-child(5) { animation-delay: 0.3s; }
    .radio-bar:nth-child(6) { animation-delay: 0.2s; }
    .radio-bar:nth-child(7) { animation-delay: 0.0s; }

    @keyframes radio-pulse {
      0%, 100% { height: 4px; opacity: 0.3; }
      50% { height: 24px; opacity: 1; }
    }

    .shimmer-text {
      background: linear-gradient(90deg, #22d3ee, #818cf8, #22d3ee);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 3s linear infinite;
    }
    
    @keyframes shimmer {
      to { background-position: 200% center; }
    }
  `}</style>
);

// ==========================================
// INTERFACES
// ==========================================

interface UIMessage extends ChatMessage {
    timestamp: number;
}

interface Session {
    id: string;
    createdAt: number;
    updatedAt: number;
    title: string;
    messages: UIMessage[];
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function AquaChat() {
    // State Management
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [inputText, setInputText] = useState<string>("");

    // User Profile integration
    // User Profile integration
    const [serialNumber, setSerialNumber] = useState<string>(() => localStorage.getItem('aqua_serial_number') || "123456");
    const [showProfile, setShowProfile] = useState<boolean>(false);


    // [STATE NOTE]: Controls the STT (Speech-to-Text) state.
    const [isListening, setIsListening] = useState<boolean>(false);

    const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    // Editing state for session titles
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState<string>("");

    // [STATE NOTE]: Controls the TTS (Text-to-Speech) state.
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

    // Report Mode State
    const [reportState, setReportState] = useState<ReportState>({
        isActive: false,
        flowStep: 'idle',
        issueData: {}
    });

    // Refs
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null); // Ref for playing audio

    // STT Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // ==========================================
    // DATA PERSISTENCE (LOCAL STORAGE)
    // ==========================================

    // Load sessions on mount
    useEffect(() => {
        const savedSessions = localStorage.getItem('aqua_sessions');
        if (savedSessions) {
            try {
                const parsed: Session[] = JSON.parse(savedSessions);
                // Sort by updatedAt desc
                parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                setSessions(parsed);
                if (parsed.length > 0) {
                    setCurrentSessionId(parsed[0].id);
                } else {
                    createNewSession();
                }
            } catch (e) {
                console.error("Failed to parse sessions:", e);
                createNewSession();
            }
        } else {
            createNewSession();
        }
    }, []);

    // Save sessions whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('aqua_sessions', JSON.stringify(sessions));
        }
    }, [sessions]);

    // Load messages for current session
    useEffect(() => {
        if (!sessions || !currentSessionId) {
            setMessages([]);
            return;
        }
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession) {
            setMessages(currentSession.messages || []);
        }
    }, [currentSessionId, sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating, isSpeaking]);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
            textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 120)}px`;
        }
    }, [inputText]);

    // ==========================================
    // LOGIC & HANDLERS
    // ==========================================
    const createNewSession = () => {
        const newId = `session_${Date.now()}`;
        const newSession: Session = {
            id: newId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            title: "New Conversation",
            messages: [{ role: 'model', text: "Hi! I'm Aqua. How can I help you today?", timestamp: Date.now() }]
        };

        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const deleteSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm("Delete this chat?")) return;

        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(updatedSessions);

        // Update local storage immediately to handle empty state
        localStorage.setItem('aqua_sessions', JSON.stringify(updatedSessions));

        if (sessionId === currentSessionId) {
            if (updatedSessions.length > 0) {
                setCurrentSessionId(updatedSessions[0].id);
            } else {
                createNewSession();
            }
        }
    };

    const startEditingSession = (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
        e.stopPropagation();
        setEditingSessionId(sessionId);
        setEditingTitle(currentTitle);
    };

    const saveSessionTitle = (e: React.MouseEvent | React.KeyboardEvent, sessionId: string) => {
        e.stopPropagation();
        if (editingTitle.trim()) {
            setSessions(prevSessions =>
                prevSessions.map(session =>
                    session.id === sessionId
                        ? { ...session, title: editingTitle.trim(), updatedAt: Date.now() }
                        : session
                )
            );
        }
        setEditingSessionId(null);
        setEditingTitle("");
    };

    const cancelEditing = () => {
        setEditingSessionId(null);
        setEditingTitle("");
    };

    // Get current session title
    const currentSessionTitle = sessions.find(s => s.id === currentSessionId)?.title || "New Conversation";

    const updateSessionMessages = (updatedMessages: UIMessage[], sessionId: string) => {
        setSessions(prevSessions => {
            return prevSessions.map(session => {
                if (session.id === sessionId) {
                    let titleUpdate = {};
                    // Auto-generate title from first user message
                    if (updatedMessages.length === 2 && updatedMessages[1].role === 'user') { // 0 is system greeting, 1 is user
                        const text = updatedMessages[1].text;
                        titleUpdate = { title: text.slice(0, 30) + (text.length > 30 ? '...' : '') };
                    } else if (updatedMessages.length === 3 && updatedMessages[1].role === 'user') {
                        // Fallback check
                        const text = updatedMessages[1].text;
                        titleUpdate = { title: text.slice(0, 30) + (text.length > 30 ? '...' : '') };
                    }

                    return {
                        ...session,
                        messages: updatedMessages,
                        updatedAt: Date.now(),
                        ...titleUpdate
                    };
                }
                return session;
            });
        });
    };

    // ==========================================
    // TEXT-TO-SPEECH (TTS) LOGIC
    // ==========================================
    const speak = async (text: string) => {
        stopSpeaking(); // Stop any current audio
        setIsSpeaking(true);
        try {
            const audioBlob = await synthesizeSpeech(text);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
                console.error("Audio playback error");
                setIsSpeaking(false);
            };
            await audio.play();
        } catch (error) {
            console.error("TTS failed:", error);
            setIsSpeaking(false);
        }
    };

    const stopSpeaking = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsSpeaking(false);
        }
    };

    // ==========================================
    // CHAT SEND LOGIC
    // ==========================================
    const handleSend = async () => {
        if (!inputText.trim() || !currentSessionId || isGenerating) return;
        stopSpeaking();
        const userMsgText = inputText;
        setInputText("");

        // If in report mode, use the structured flow instead of LLM
        if (reportState.isActive && reportState.flowStep !== 'idle' && reportState.flowStep !== 'connecting' && reportState.flowStep !== 'connected') {
            handleReportFlowInput(userMsgText);
            return;
        }

        // Normal chat flow - use LLM
        const newUserMsg: UIMessage = { role: 'user', text: userMsgText, timestamp: Date.now() };
        const newMessages = [...messages, newUserMsg];
        setMessages(newMessages);
        setIsGenerating(true);
        updateSessionMessages(newMessages, currentSessionId);

        const historyForApi = newMessages.filter(m => m.role !== 'system' && (m.role === 'user' || m.role === 'model'));
        const aiText = await chatCompletion(historyForApi, userMsgText, 'normal', serialNumber);


        const newAiMsg: UIMessage = { role: 'model', text: aiText, timestamp: Date.now() };
        const finalMessages = [...newMessages, newAiMsg];

        setMessages(finalMessages);
        setIsGenerating(false);
        updateSessionMessages(finalMessages, currentSessionId);

        // Triggers TTS after response
        speak(aiText);
    };


    // ==========================================
    // SPEECH-TO-TEXT (STT) LOGIC
    // ==========================================
    const toggleListening = async () => {
        stopSpeaking();

        if (isListening) {
            // STOP RECORDING
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsListening(false);
        } else {
            // START RECORDING
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorderRef.current.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    // Provide visual feedback or loading state here if desired

                    try {
                        const text = await transcribeAudio(audioBlob);
                        if (text) {
                            setInputText(prev => prev + (prev ? " " : "") + text);
                        }
                    } catch (err) {
                        console.error("Transcription error:", err);
                        // Optionally set an error message in UI
                    }

                    // Stop all tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorderRef.current.start();
                setIsListening(true);
                setInputText(""); // Clear previous text? Or maybe append? Current behavior is clear.
            } catch (err) {
                console.error("Microphone access denied:", err);
                alert("Could not access microphone.");
            }
        }
    };

    // ==========================================
    // REPORT MODE LOGIC - Structured Flow
    // ==========================================

    // Predefined responses for each step
    const REPORT_FLOW_RESPONSES = {
        ask_problem: "I'm here to help you report a water issue. What's the problem? (e.g., pipe leak, burst pipe, no water, low pressure)",
        ask_location: "I'm sorry to hear that. Where exactly is this happening? (e.g., kitchen, bathroom, outside)",
        ask_severity: "Got it. How severe is the issue? Is it a small drip, steady flow, or flooding?",
        confirm: (data: { problem?: string; location?: string; severity?: string }) =>
            `Let me confirm: You have a ${data.problem || 'water issue'} in your ${data.location || 'home'}, and it's ${data.severity || 'causing problems'}. I'll connect you with a plumber now.`
    };

    const enterReportMode = () => {
        setReportState({
            isActive: true,
            flowStep: 'ask_problem',
            issueData: {}
        });
        // Use functional update to ensure we have the latest messages
        setMessages(prev => {
            const msg: UIMessage = { role: 'model', text: REPORT_FLOW_RESPONSES.ask_problem, timestamp: Date.now() };
            const newMessages = [...prev, msg];
            if (currentSessionId) {
                updateSessionMessages(newMessages, currentSessionId);
            }
            speak(REPORT_FLOW_RESPONSES.ask_problem);
            return newMessages;
        });
    };

    const exitReportMode = () => {
        setReportState({
            isActive: false,
            flowStep: 'idle',
            issueData: {}
        });
        const exitMsg = "Report mode ended. How else can I help you today?";
        setMessages(prev => {
            const msg: UIMessage = { role: 'model', text: exitMsg, timestamp: Date.now() };
            const newMessages = [...prev, msg];
            if (currentSessionId) {
                updateSessionMessages(newMessages, currentSessionId);
            }
            speak(exitMsg);
            return newMessages;
        });
    };

    const toggleReportMode = () => {
        if (reportState.isActive) {
            exitReportMode();
        } else {
            enterReportMode();
        }
    };

    // Handle user input in report mode - advance the flow
    const handleReportFlowInput = (userInput: string) => {
        const input = userInput.trim();
        if (!input) return;

        // Add user message first, then add Aqua response
        const userMsg: UIMessage = { role: 'user', text: input, timestamp: Date.now() };

        // Determine the next response based on current step
        let nextResponse = '';
        let nextStep = reportState.flowStep;
        let updatedIssueData = { ...reportState.issueData };

        switch (reportState.flowStep) {
            case 'ask_problem':
                nextResponse = REPORT_FLOW_RESPONSES.ask_location;
                nextStep = 'ask_location';
                updatedIssueData.problem = input;
                break;

            case 'ask_location':
                nextResponse = REPORT_FLOW_RESPONSES.ask_severity;
                nextStep = 'ask_severity';
                updatedIssueData.location = input;
                break;

            case 'ask_severity':
                updatedIssueData.severity = input;
                nextResponse = REPORT_FLOW_RESPONSES.confirm(updatedIssueData);
                nextStep = 'confirm';
                break;

            default:
                return;
        }

        // Update report state
        setReportState(prev => ({
            ...prev,
            flowStep: nextStep,
            issueData: updatedIssueData
        }));

        // Add both messages: user message immediately, Aqua response after delay
        setMessages(prev => {
            const withUserMsg = [...prev, userMsg];
            if (currentSessionId) {
                updateSessionMessages(withUserMsg, currentSessionId);
            }
            return withUserMsg;
        });

        // Add Aqua response after a short delay
        setTimeout(() => {
            const aquaMsg: UIMessage = { role: 'model', text: nextResponse, timestamp: Date.now() };
            setMessages(prev => {
                const withAquaMsg = [...prev, aquaMsg];
                if (currentSessionId) {
                    updateSessionMessages(withAquaMsg, currentSessionId);
                }
                speak(nextResponse);
                return withAquaMsg;
            });

            // If we just confirmed, initiate plumber connection after another delay
            if (nextStep === 'confirm') {
                setTimeout(() => initiatePlumberConnection(), 2000);
            }
        }, 500);
    };

    const initiatePlumberConnection = () => {
        const userProfile = getUserProfile();
        const area = userProfile?.area || 'Johor Bahru';
        const plumber = getRandomAvailablePlumber(area);

        setReportState(prev => ({
            ...prev,
            flowStep: 'connecting',
            selectedPlumber: plumber || undefined
        }));
    };

    const handlePlumberConnected = () => {
        setReportState(prev => ({
            ...prev,
            flowStep: 'connected'
        }));
    };

    const handleEndCall = () => {
        const thankYouMsg = "Thank you for using our service. The plumber will contact you shortly. Is there anything else I can help you with?";
        setMessages(prev => {
            const msg: UIMessage = { role: 'model', text: thankYouMsg, timestamp: Date.now() };
            const newMessages = [...prev, msg];
            if (currentSessionId) {
                updateSessionMessages(newMessages, currentSessionId);
            }
            speak(thankYouMsg);
            return newMessages;
        });

        // Reset report state
        setReportState({
            isActive: false,
            flowStep: 'idle',
            issueData: {}
        });
    };

    // --- Render ---
    return (
        <div className={`flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-100 relative ${reportState.isActive ? 'report-mode' : ''}`}>
            <GlobalStyles />

            {/* Report Mode Banner */}
            {reportState.isActive && (
                <ReportModeBanner onExit={exitReportMode} />
            )}

            {/* Profile Modal - Moved to root for full screen overlay */}
            {showProfile && (
                <ProfilePage
                    currentSerial={serialNumber}
                    onSave={(serial) => {
                        setSerialNumber(serial);
                        localStorage.setItem('aqua_serial_number', serial);
                    }}
                    onClose={() => setShowProfile(false)}
                />
            )}

            {/* Plumber Connection Modal */}
            {(reportState.flowStep === 'connecting' || reportState.flowStep === 'connected') && (
                <PlumberConnectionModal
                    stage={reportState.flowStep as 'connecting' | 'connected'}
                    plumber={reportState.selectedPlumber || null}
                    onClose={() => setReportState(prev => ({ ...prev, flowStep: 'idle', isActive: false }))}
                    onEndCall={handleEndCall}
                    onConnected={handlePlumberConnected}
                />
            )}

            {/* Background Ambient Glows */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

            {/* Sidebar - Collapsible Drawer */}
            <div
                className={`
          fixed inset-y-0 left-0 z-50 glass-panel
          transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] 
          flex flex-col overflow-hidden
          ${isSidebarOpen ? 'w-[85vw] md:w-80 translate-x-0 opacity-100' : 'w-0 -translate-x-10 opacity-0'}
        `}
            >


                {/* Sidebar Header */}
                <div className="p-5 flex items-center justify-between h-20 shrink-0">
                    <h2 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-40 rounded-full" />
                            <Bot size={28} className="relative text-cyan-400" />
                        </div>
                        <span className="shimmer-text font-bold">Aqua</span>
                    </h2>

                    {/* Close Sidebar Button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close Sidebar"
                        className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="px-4 pb-2 shrink-0">
                    <button
                        onClick={createNewSession}
                        aria-label="Start New Chat"
                        className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300 active:scale-[0.98] border border-white/10 whitespace-nowrap"
                    >
                        <Plus size={22} strokeWidth={2.5} />
                        <span className="font-medium tracking-wide">New Chat</span>
                    </button>
                </div>



                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 w-full">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => {
                                if (editingSessionId !== session.id) {
                                    setCurrentSessionId(session.id);
                                    if (window.innerWidth < 768) setSidebarOpen(false);
                                }
                            }}
                            className={`
                group flex items-center justify-between p-3.5 px-4 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden
                ${currentSessionId === session.id
                                    ? 'bg-white/10 text-cyan-200 shadow-inner'
                                    : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}
              `}
                        >
                            <div className="flex items-center gap-3.5 overflow-hidden z-10 flex-1 min-w-0">
                                {editingSessionId === session.id ? (
                                    <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                saveSessionTitle(e, session.id);
                                            } else if (e.key === 'Escape') {
                                                cancelEditing();
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                        className="bg-zinc-800 text-zinc-100 text-sm font-medium tracking-wide px-2 py-1 rounded-lg outline-none border border-cyan-500/50 w-full"
                                    />
                                ) : (
                                    <span className="truncate text-sm font-medium tracking-wide">
                                        {session.title || "New Conversation"}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 z-10">
                                {editingSessionId === session.id ? (
                                    <button
                                        onClick={(e) => saveSessionTitle(e, session.id)}
                                        aria-label="Save Title"
                                        className="p-1.5 hover:text-green-400 transition-all"
                                    >
                                        <Check size={15} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => startEditingSession(e, session.id, session.title)}
                                        aria-label="Edit Title"
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-cyan-400 transition-all"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => deleteSession(e, session.id)}
                                    aria-label="Delete Session"
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 transition-all"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div
                className={`
          flex-1 flex flex-col h-full w-full relative transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isSidebarOpen && window.innerWidth >= 768 ? 'ml-80' : 'ml-0'}
        `}
            >

                {/* Top Navigation */}
                <header className="h-20 flex items-center justify-between px-6 md:px-8 absolute top-0 left-0 right-0 z-30 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            aria-label="Open Sidebar"
                            className={`
                p-2.5 bg-zinc-900/80 backdrop-blur-md rounded-xl text-zinc-300 border border-white/10 hover:bg-zinc-800 transition-all shadow-lg
                ${isSidebarOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}
              `}
                        >
                            <PanelLeftOpen size={22} />
                        </button>
                    </div>

                    {/* Conversation Title */}
                    <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto">
                        <h1 className="text-lg font-semibold text-white truncate max-w-[200px] md:max-w-md tracking-tight">
                            {currentSessionTitle}
                        </h1>
                    </div>

                    {/* Profile Button (Top Right) */}
                    <div className="pointer-events-auto">
                        <button
                            onClick={() => setShowProfile(true)}
                            className="p-2.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-cyan-400 transition-all border border-transparent hover:border-white/10 relative"
                            title={serialNumber ? `Connected: ${serialNumber}` : "Sign In for Personalized Data"}
                        >
                            <User size={22} />
                            {serialNumber && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-500 border-2 border-[#09090b] rounded-full"></span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-24 pb-4 scroll-smooth space-y-8">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 select-none pb-20">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center relative shadow-2xl rotate-3">
                                    <Bot size={48} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-light text-white mb-2 tracking-tight">Welcome to <span className="shimmer-text font-semibold">Aqua</span></h3>
                            <p className="text-sm text-zinc-400 max-w-xs text-center leading-relaxed font-light">
                                Your intelligent companion. Ask me anything or click the microphone to speak.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-5 max-w-4xl mx-auto group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role !== 'user' && (
                                    <div className="w-9 h-9 rounded-2xl bg-zinc-800/80 border border-white/5 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                                        <Bot size={18} className="text-cyan-400" />
                                    </div>
                                )}

                                <div
                                    className={`
                    relative px-6 py-4 rounded-[24px] text-[15px] leading-7 tracking-wide backdrop-blur-sm shadow-sm max-w-[85%] md:max-w-[70%]
                    transition-all duration-300 font-light
                    ${msg.role === 'user'
                                            ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-[0_4px_20px_rgba(6,182,212,0.2)]'
                                            : 'bg-zinc-800/40 text-zinc-100 rounded-tl-sm border border-white/5 hover:bg-zinc-800/60 shadow-lg'}
                  `}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))
                    )}

                    {isGenerating && (
                        <div className="flex gap-5 max-w-4xl mx-auto justify-start">
                            <div className="w-9 h-9 rounded-2xl bg-zinc-800/80 border border-white/5 flex items-center justify-center shrink-0 mt-1">
                                <Bot size={18} className="text-cyan-400" />
                            </div>
                            <div className="bg-zinc-800/40 px-6 py-5 rounded-[24px] rounded-tl-sm border border-white/5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-2" />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 flex flex-col items-center w-full bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent pt-10 relative z-50">

                    {/* Radio Wave Visualizer (Floating Above Input) */}
                    {isListening && (
                        <div className="mb-4 flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="radio-wave-container">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="radio-bar" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Clean Input Capsule */}
                    <div className={`
            w-full max-w-3xl rounded-[28px] pl-1.5 pr-2 py-1.5 flex items-end gap-2 transition-all duration-300 relative
            glass-input ${isListening ? 'recording' : ''}
          `}>

                        <button
                            type="button"
                            onClick={toggleReportMode}
                            aria-label={reportState.isActive ? "Exit Report Mode" : "Request Fix"}
                            className={`h-9 w-9 rounded-full transition-all duration-300 shrink-0 flex items-center justify-center cursor-pointer mb-[1px] mr-1 ${reportState.isActive
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                                : 'hover:bg-zinc-700/50 text-zinc-400 hover:text-amber-400'
                                }`}
                        >
                            <Hammer size={18} strokeWidth={2.5} />
                        </button>

                        <textarea
                            ref={textAreaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={isListening ? "Listening..." : "Ask Aqua anything..."}
                            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none py-2 px-1 text-[15px] leading-5 font-light animate-in fade-in scrollbar-hide"
                            rows={1}
                            style={{ minHeight: '36px' }}
                        />

                        {inputText.trim() ? (
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={isGenerating}
                                aria-label="Send Message"
                                className={`
                    h-9 w-9 rounded-full transition-all duration-300 shrink-0 flex items-center justify-center cursor-pointer mb-[1px]
                    ${isGenerating
                                        ? 'bg-transparent text-zinc-600 cursor-not-allowed opacity-50'
                                        : 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-105 active:scale-95'}
                  `}
                            >
                                <Send size={16} strokeWidth={2.5} className="ml-0.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={toggleListening}
                                aria-label={isListening ? "Stop Recording" : "Start Recording"}
                                className={`
                    h-9 w-9 rounded-full transition-all duration-300 shrink-0 flex items-center justify-center cursor-pointer mb-[1px]
                    ${isListening
                                        ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105'
                                        : 'hover:bg-zinc-700/50 text-zinc-400 hover:text-cyan-400'}
                  `}
                            >
                                {isListening ? (
                                    <StopCircle size={18} fill="currentColor" className="text-white" />
                                ) : (
                                    <Mic size={18} strokeWidth={2.5} />
                                )}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
import { useState, useEffect } from 'react';
import { User, MapPin, Receipt, Droplets, X, Save, Calendar, CheckCircle, AlertCircle, Lock, CreditCard, ChevronRight, Loader2 } from 'lucide-react';

interface ProfilePageProps {
    currentSerial: string;
    onSave: (serial: string) => void;
    onClose: () => void;
}

// Mock Data for Display (Matches Backend)
const MOCK_PROFILES: Record<string, any> = {
    "123456": {
        name: "Ali bin Abu",
        password: "password123", // Mock password
        address: "No 12, Jalan Ria 2, Taman Molek, 81100 JB",
        lastBillAmount: "RM45.50",
        lastBillDate: "01 Jan 2026",
        billingStatus: "Unpaid",
        lastPayment: "RM40.00 on 10 Dec 2025",
        averageUsage: "35 m³",
        status: "Active"
    },
    "789012": {
        name: "Siti binti Ahmad",
        password: "password123",
        address: "45, Jalan Merdeka, Skudai, 81300 JB",
        lastBillAmount: "RM120.00",
        lastBillDate: "01 Jan 2026",
        billingStatus: "Unpaid",
        lastPayment: "RM50.00 on 15 Nov 2025",
        averageUsage: "60 m³",
        status: "High Usage Alert"
    }
};

export default function ProfilePage({ currentSerial, onSave, onClose }: ProfilePageProps) {
    const [serialInput, setSerialInput] = useState(currentSerial || "123456");
    const [passwordInput, setPasswordInput] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(!!currentSerial);

    // User requested: "by default already logged in 123456". So if currentSerial matches 123456, we are logged in.

    const [profileData, setProfileData] = useState<any>(null);
    const [loginError, setLoginError] = useState("");

    // Payment Mock State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'processing' | 'success'>('processing');

    useEffect(() => {
        // Initialize logic: if passed serial exists in mock, load it.
        if (currentSerial && MOCK_PROFILES[currentSerial]) {
            setProfileData(MOCK_PROFILES[currentSerial]);
            setIsLoggedIn(true);
        } else if (serialInput === "123456" && !currentSerial) {
            // Default case if no prop passed but we want 123456 default
            setProfileData(MOCK_PROFILES["123456"]);
            setIsLoggedIn(true);
        }
    }, []);

    const handleLogin = () => {
        const profile = MOCK_PROFILES[serialInput];
        if (profile) {
            if (passwordInput === profile.password || passwordInput === "admin") { // simple mock auth
                setProfileData(profile);
                setIsLoggedIn(true);
                setLoginError("");
                onSave(serialInput); // Persist login
            } else {
                setLoginError("Invalid password (try 'password123')");
            }
        } else {
            setLoginError("Serial number not found");
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setProfileData(null);
        setPasswordInput("");
        onSave(""); // Clear persistence
    };

    const handlePayNow = () => {
        setShowPaymentModal(true);
        setPaymentStep('processing');
        // Simulate payment processing
        setTimeout(() => {
            setPaymentStep('success');
        }, 2000);
    };

    const closePaymentModal = () => {
        setShowPaymentModal(false);
        // Update mock status to Paid for this session?
        if (profileData) {
            setProfileData({ ...profileData, billingStatus: 'Paid', status: 'Active (Paid)' });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#09090b]/95 backdrop-blur-md animate-fade-in p-4 md:p-8">

            {/* Payment Gateway Mock Modal */}
            {showPaymentModal && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in fade-in zoom-in duration-300">
                        {paymentStep === 'processing' ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 rounded-full" />
                                    <Loader2 className="animate-spin text-cyan-600" size={48} />
                                </div>
                                <h3 className="text-xl font-semibold">Processing Payment...</h3>
                                <p className="text-zinc-500 text-sm">Connecting to Secure Gateway</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 space-y-4">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-2xl font-bold text-zinc-900">Payment Successful!</h3>
                                <p className="text-zinc-600 text-center text-sm px-4">
                                    Your payment of <span className="font-bold">{profileData?.lastBillAmount}</span> has been received.
                                </p>
                                <p className="text-xs text-zinc-400 font-mono">Ref: TXN-{Math.floor(Math.random() * 1000000)}</p>
                                <button
                                    onClick={closePaymentModal}
                                    className="w-full py-3 mt-4 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={`w-full max-w-5xl bg-[#09090b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden glass-panel relative flex flex-col md:flex-row h-full md:h-auto md:max-h-[85vh] transition-all duration-500`}>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 text-zinc-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                >
                    <X size={20} />
                </button>

                {/* Left Panel: Login / User Identity */}
                <div className="p-8 md:w-[40%] border-b md:border-b-0 md:border-r border-white/10 flex flex-col bg-zinc-900/50">
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl text-cyan-400 border border-white/5">
                                <User size={28} />
                            </div>
                            {isLoggedIn ? "Account Access" : "Secure Login"}
                        </h2>
                        <p className="text-zinc-400 text-sm mt-3 font-light leading-relaxed">
                            {isLoggedIn
                                ? "You are securely logged in. View your usage analytics and billing details."
                                : "Please verify your utility account credentials to proceed."}
                        </p>
                    </div>

                    {!isLoggedIn ? (
                        <div className="space-y-5 flex-1 animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="space-y-1.5">
                                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Meter Serial Number</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={serialInput}
                                        onChange={(e) => setSerialInput(e.target.value)}
                                        placeholder="e.g. 123456"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                                    />
                                    <Droplets size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                                    />
                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                                </div>
                                <p className="text-xs text-zinc-600 text-right">Mock Pass: <span className="font-mono text-zinc-500">password123</span></p>
                            </div>

                            {loginError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle size={16} /> {loginError}
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={handleLogin}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
                                >
                                    Access Account
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="bg-zinc-800/30 rounded-2xl p-5 border border-white/5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-lg font-bold border border-cyan-500/20">
                                        {profileData?.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium text-lg">{profileData?.name}</div>
                                        <div className="text-zinc-500 text-sm font-mono flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            {serialInput}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="flex items-start gap-3 text-zinc-400 text-sm">
                                    <MapPin size={16} className="mt-0.5 shrink-0" />
                                    {profileData?.address}
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full py-3.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all font-medium mt-6"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Panel: Data Display */}
                <div className="flex-1 p-8 md:p-10 bg-[#09090b] relative flex flex-col justify-center">
                    {isLoggedIn && profileData ? (
                        <div className="space-y-8 animate-slide-up max-w-lg mx-auto w-full">

                            {/* Status Banner */}
                            <div className={`p-4 rounded-2xl border flex items-center gap-4 ${profileData.status.includes("Active") ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-200" : "bg-red-500/5 border-red-500/20 text-red-200"}`}>
                                {profileData.status.includes("Active") ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
                                <div>
                                    <div className="font-semibold text-lg">{profileData.status}</div>
                                    <div className="text-sm opacity-70">Current Account Standing</div>
                                </div>
                            </div>

                            {/* Billing Card (Larger) */}
                            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 rounded-3xl p-6 border border-white/10 relative overflow-hidden group hover:border-cyan-500/30 transition-all shadow-xl">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                                    <Receipt size={120} className="text-white" />
                                </div>

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="text-sm text-zinc-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-2">
                                            <Calendar size={14} /> Last Bill
                                        </div>
                                        <div className="text-amber-500 text-xs font-mono">{profileData.lastBillDate}</div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${profileData.billingStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                                        {profileData.billingStatus}
                                    </div>
                                </div>

                                <div className="text-5xl font-bold text-white mb-2 tracking-tight">{profileData.lastBillAmount}</div>
                                <div className="text-zinc-500 text-sm mb-6">Due immediately</div>

                                {profileData.billingStatus === 'Unpaid' && (
                                    <button
                                        onClick={handlePayNow}
                                        className="w-full py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-cyan-50 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                                    >
                                        <CreditCard size={20} />
                                        Pay Bill Now
                                    </button>
                                )}
                            </div>

                            {/* Usage Card */}
                            <div className="bg-zinc-900/40 rounded-3xl p-6 border border-white/5 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-zinc-400 uppercase tracking-wider font-semibold mb-1">Avg. Monthly Usage</div>
                                    <div className="text-3xl font-bold text-blue-100">{profileData.averageUsage}</div>
                                    <div className="text-xs text-zinc-600 mt-1">Based on 3-month average</div>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <Droplets size={32} />
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-6">
                            <div className="w-24 h-24 rounded-[2rem] bg-zinc-900 border border-dashed border-zinc-800 flex items-center justify-center shadow-inner">
                                <Lock size={48} className="opacity-20" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-xl font-medium text-zinc-500">Authentication Required</p>
                                <p className="text-sm text-zinc-700 max-w-xs mx-auto">Please secure login via the panel on the left to access sensitive billing information.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

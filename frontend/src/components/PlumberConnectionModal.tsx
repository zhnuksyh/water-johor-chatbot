import React, { useEffect } from 'react';
import { Phone, Star, X } from 'lucide-react';
import { Plumber } from '../types';

interface PlumberConnectionModalProps {
    stage: 'connecting' | 'connected';
    plumber: Plumber | null;
    onClose: () => void;
    onEndCall: () => void;
    onConnected?: () => void;
}

const PlumberConnectionModal: React.FC<PlumberConnectionModalProps> = ({
    stage,
    plumber,
    onClose,
    onEndCall,
    onConnected
}) => {
    useEffect(() => {
        if (stage === 'connecting' && onConnected) {
            const timer = setTimeout(() => {
                onConnected();
            }, 3000 + Math.random() * 2000);
            return () => clearTimeout(timer);
        }
    }, [stage, onConnected]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 max-w-md w-full text-center relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                {stage === 'connecting' ? (
                    <>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Phone size={40} className="text-amber-400 animate-bounce" />
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Connecting...</h2>
                        <p className="text-zinc-400 mb-6">Finding available plumber in your area</p>
                        <div className="flex justify-center gap-2">
                            {[0, 1, 2].map(i => (
                                <div
                                    key={i}
                                    className="w-3 h-3 bg-amber-500 rounded-full animate-bounce"
                                    style={{ animationDelay: `${i * 150}ms` }}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Phone size={40} className="text-green-400" />
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-2">Connected!</h2>

                        {plumber && (
                            <div className="bg-zinc-800 rounded-2xl p-4 mb-6">
                                <p className="text-lg font-medium text-white">{plumber.name}</p>
                                <p className="text-amber-400 font-mono">{plumber.phone}</p>
                                <p className="text-zinc-400 text-sm mt-1">{plumber.specialization}</p>
                                <div className="flex items-center justify-center gap-1 mt-2">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={16}
                                            className={
                                                i < Math.floor(plumber.rating)
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-zinc-600'
                                            }
                                        />
                                    ))}
                                    <span className="text-sm text-zinc-400 ml-1">{plumber.rating}</span>
                                </div>
                            </div>
                        )}

                        <p className="text-zinc-500 text-xs mb-6">
                            (This is a simulation - no actual call is being made)
                        </p>

                        <button
                            onClick={onEndCall}
                            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                        >
                            End Call
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PlumberConnectionModal;

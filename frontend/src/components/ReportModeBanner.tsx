import React from 'react';
import { Hammer, X } from 'lucide-react';

interface ReportModeBannerProps {
    onExit: () => void;
}

const ReportModeBanner: React.FC<ReportModeBannerProps> = ({ onExit }) => {
    return (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <Hammer size={18} className="text-white" />
                </div>
                <div>
                    <p className="font-semibold text-sm">Report Mode Active</p>
                    <p className="text-xs text-white/80">Describe your water issue to get help</p>
                </div>
            </div>
            <button
                onClick={onExit}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Exit Report Mode"
            >
                <X size={20} />
            </button>
        </div>
    );
};

export default ReportModeBanner;

export interface UserProfile {
    id: string;
    name: string;
    phone: string;
    area: string;
    address: string;
    accountNumber?: string;
}

export interface Plumber {
    id: string;
    name: string;
    phone: string;
    area: string;
    specialization: string;
    rating: number;
    available: boolean;
}

export type ReportFlowStep = 'idle' | 'ask_problem' | 'ask_location' | 'ask_severity' | 'confirm' | 'connecting' | 'connected';

export interface ReportState {
    isActive: boolean;
    flowStep: ReportFlowStep;
    issueData: {
        problem?: string;
        location?: string;
        severity?: string;
    };
    selectedPlumber?: Plumber;
}

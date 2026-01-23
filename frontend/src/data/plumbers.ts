import { Plumber } from '../types';

export const PLUMBERS_BY_AREA: Record<string, Plumber[]> = {
    "Johor Bahru": [
        {
            id: "p1",
            name: "Ahmad Plumbing Services",
            phone: "+60 7-223 4567",
            area: "Johor Bahru",
            specialization: "Pipe Repair & Installation",
            rating: 4.5,
            available: true
        },
        {
            id: "p2",
            name: "Tan Water Solutions",
            phone: "+60 7-234 5678",
            area: "Johor Bahru",
            specialization: "Leak Detection & Repair",
            rating: 4.8,
            available: true
        },
        {
            id: "p3",
            name: "JB Emergency Plumbing",
            phone: "+60 7-245 6789",
            area: "Johor Bahru",
            specialization: "24/7 Emergency Services",
            rating: 4.3,
            available: true
        }
    ],
    "Pasir Gudang": [
        {
            id: "p4",
            name: "Lee Brothers Plumbing",
            phone: "+60 7-251 2345",
            area: "Pasir Gudang",
            specialization: "Industrial & Residential",
            rating: 4.2,
            available: true
        },
        {
            id: "p5",
            name: "PG Water Works",
            phone: "+60 7-252 3456",
            area: "Pasir Gudang",
            specialization: "Pipe Burst Repair",
            rating: 4.6,
            available: true
        }
    ],
    "Kulai": [
        {
            id: "p6",
            name: "Kulai Plumbing Pro",
            phone: "+60 7-663 4567",
            area: "Kulai",
            specialization: "Residential Plumbing",
            rating: 4.4,
            available: true
        },
        {
            id: "p7",
            name: "Rapid Fix Plumbing",
            phone: "+60 7-664 5678",
            area: "Kulai",
            specialization: "Emergency Leak Repair",
            rating: 4.1,
            available: true
        }
    ],
    "Iskandar Puteri": [
        {
            id: "p8",
            name: "Puteri Plumbing Services",
            phone: "+60 7-509 1234",
            area: "Iskandar Puteri",
            specialization: "Modern Home Plumbing",
            rating: 4.7,
            available: true
        },
        {
            id: "p9",
            name: "Medini Water Solutions",
            phone: "+60 7-509 2345",
            area: "Iskandar Puteri",
            specialization: "Commercial & Residential",
            rating: 4.5,
            available: true
        }
    ],
    "Pontian": [
        {
            id: "p10",
            name: "Pontian Plumbing Co.",
            phone: "+60 7-687 1234",
            area: "Pontian",
            specialization: "Rural & Town Plumbing",
            rating: 4.3,
            available: true
        }
    ],
    "Kota Tinggi": [
        {
            id: "p11",
            name: "KT Plumbing Services",
            phone: "+60 7-883 1234",
            area: "Kota Tinggi",
            specialization: "General Plumbing",
            rating: 4.2,
            available: true
        }
    ],
    "Mersing": [
        {
            id: "p12",
            name: "Mersing Water Works",
            phone: "+60 7-799 1234",
            area: "Mersing",
            specialization: "Coastal Area Specialist",
            rating: 4.0,
            available: true
        }
    ]
};

export const getPlumbersByArea = (area: string): Plumber[] => {
    return PLUMBERS_BY_AREA[area] || PLUMBERS_BY_AREA["Johor Bahru"];
};

export const getRandomAvailablePlumber = (area: string): Plumber | null => {
    const plumbers = getPlumbersByArea(area);
    const available = plumbers.filter(p => p.available);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
};

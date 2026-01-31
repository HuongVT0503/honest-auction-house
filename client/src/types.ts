export interface User {
    id: number;
    username: string;
    role: 'USER' | 'ADMIN';
    createdAt?: string;
}

export interface Auction {
    id: number;
    title: string;
    description?: string;
    status: "OPEN" | "REVEAL" | "CLOSED";
    seller: { username: string };
    createdAt: string;      
    durationMinutes: number; 
    biddingEndsAt?: string;
    winner?: { username: string };
    winningAmount?: number;
}

export interface BidHistory {
    id: number;
    amount: number | null;
    commitment: string;
    auction: {id: number; title: string };
    bidder?: { username: string };
    createdAt: string;
}

export interface LocalBid {
    amount: number;
    secret: string;
    commitment: string;
    timestamp: number;
}
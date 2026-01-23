export interface User {
    id: number;
    username: string;
    role: 'USER' | 'ADMIN';
    createdAt?: string;
}

export interface Auction {
    id: number;
    title: string;
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
    auction: { title: string };
    bidder?: { username: string };
    createdAt: string;
}
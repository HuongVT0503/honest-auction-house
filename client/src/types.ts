export interface User {
    id: number;
    username: string;
    role: 'USER' | 'ADMIN';
}

export interface Auction {
    id: number;
    title: string;
    status: "OPEN" | "REVEAL" | "CLOSED";
    seller: { username: string };
    endsAt: string;
}

export interface BidHistory {
    id: number;
    amount: number | null;
    auction: { title: string };
    createdAt: string;
}
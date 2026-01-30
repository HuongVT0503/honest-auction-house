export interface Groth16Proof {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
    protocol: string;
    curve: string;
}

export type PublicSignals = string[];

export interface BidProofRequest {
    auctionId: number;
    proof: Groth16Proof;
    publicSignals: PublicSignals;
}

export interface RevealRequest {
    auctionId: number;
    bidderId: number;
    amount: string; //keep string type until BigInt conversion
    secret: string;
}
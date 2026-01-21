// @ts-expect-error - snarkjs lacks typescript definitions
import * as snarkjs from 'snarkjs';

export interface ProofResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proof: any;
    publicSignals: string[];
}

export async function generateBidProof(amount: number, secret: string): Promise<ProofResult> {
    console.log("Generating proof for:", { amount, secret });

    //format inputs to match circuit (BigInt strings usually preferred)
    const input = {
        amount: amount.toString(),
        secret: secret.toString()
    };

    //call snarkjs
    // Paths are relative to the public folder (index.html)
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/bid_check.wasm",       // Path to WASM in public/
        "/bid_check_final.zkey"  // Path to ZKey in public/
    );

    console.log("Proof Generated:", publicSignals);

    return { proof, publicSignals };
}
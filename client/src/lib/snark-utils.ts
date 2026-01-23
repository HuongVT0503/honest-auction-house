// @ts-expect-error - snarkjs lacks typescript definitions
import * as snarkjs from 'snarkjs';
// @ts-expect-error - no types for circomlibjs
import { buildPoseidon } from 'circomlibjs';

export interface ProofResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proof: any;
    publicSignals: string[];
}

export async function generateBidProof(amount: number, secret: string, auctionId: number): Promise<ProofResult> {
    console.log("Generating proof for:", { amount, secret, auctionId });

    //validate input: Secrets must be numeric
    if (isNaN(Number(secret))) {
        throw new Error("The Secret must be a NUMBER.");
    }

    //initialize Poseidon Hash (Async)
    const poseidon = await buildPoseidon();

    //calculate the Commitment Hash
    //hash [amount, secret] just like the circuit does
    const secretBigInt = BigInt(secret);
    const amountBigInt = BigInt(amount);
    const auctionIdBigInt = BigInt(auctionId);

    const hashBytes = poseidon([amountBigInt, secretBigInt, auctionIdBigInt]);

    // Convert the hash bytes to a string number (Finite Field representation)
    const commitment = poseidon.F.toString(hashBytes);
    console.log("Calculated Commitment:", commitment);

    //create Input Object
    // Matches bid_check.circom: amount, secret, AND commitment
    const input = {
        amount: amountBigInt.toString(),
        secret: secretBigInt.toString(),
        auctionId: auctionIdBigInt.toString(),
        commitment: commitment
    };

    //generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/bid_check.wasm",
        "/bid_check_final.zkey"
    );

    console.log("Proof Generated:", publicSignals);

    return { proof, publicSignals };
}
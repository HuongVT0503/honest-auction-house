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

    //range check
    //Number.MAX_SAFE_INTEGER (2^53 - 1)
    //circuit supports up to 2^64 - 1
    if (amount < 0) {
        throw new Error("Amount cannot be negative.");
    }
    if (!Number.isInteger(amount)) {
        throw new Error("Amount must be a whole number.");
    }
    if (amount > Number.MAX_SAFE_INTEGER) {
        throw new Error("Amount is too large (unsafe for browser JS).");
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
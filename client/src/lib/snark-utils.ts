// @ts-expect-error - snarkjs lacks typescript definitions
import * as snarkjs from 'snarkjs';
// @ts-expect-error - no types for circomlibjs
import { buildPoseidon } from 'circomlibjs';

export interface ProofResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proof: any;
    publicSignals: string[];
}

export async function generateBidProof(amount: number, secret: string): Promise<ProofResult> {
    console.log("Generating proof for:", { amount, secret });

    //validate input: Secrets must be numeric
    if (isNaN(Number(secret))) {
        throw new Error("For this prototype, the Secret must be a NUMBER (e.g., '12345').");
    }

    //initialize Poseidon Hash (Async)
    const poseidon = await buildPoseidon();

    //calculate the Commitment Hash
    //hash [amount, secret] just like the circuit does
    const secretBigInt = BigInt(secret);
    const amountBigInt = BigInt(amount);

    const hashBytes = poseidon([amountBigInt, secretBigInt]);

    // Convert the hash bytes to a string number (Finite Field representation)
    const commitment = poseidon.F.toString(hashBytes);
    console.log("Calculated Commitment:", commitment);

    //create Input Object
    // Matches bid_check.circom: amount, secret, AND commitment
    const input = {
        amount: amountBigInt.toString(),
        secret: secretBigInt.toString(),
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
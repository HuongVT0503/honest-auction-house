import * as snarkjs from "snarkjs";
import fs from "fs";
import path from "path";
import { Groth16Proof, PublicSignals } from "../types/zkp";

//load the key once at startup
const vKeyPath = path.join(__dirname, "../verification_key.json");
const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf-8"));

function isGroth16Proof(obj: unknown): obj is Groth16Proof {
    if (typeof obj !== 'object' || obj === null) return false;

    const p = obj as Groth16Proof;
    return (
        Array.isArray(p.pi_a) && p.pi_a.length === 3 &&
        Array.isArray(p.pi_b) && p.pi_b.length === 3 &&
        Array.isArray(p.pi_c) && p.pi_c.length === 3 &&
        typeof p.protocol === 'string' &&
        typeof p.curve === 'string'
    );
}

export async function verifyBidProof(proof: unknown, publicSignals: unknown): Promise<boolean> {
    try {
        if (!isGroth16Proof(proof)) {
            console.error("Invalid Proof Structure");
            return false;
        }

        if (!Array.isArray(publicSignals)) {
            console.error("Invalid Public Signals Structure");
            return false;
        }

        //verify proof using verification key
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        return isValid;
    } catch (error) {
        console.error("Verification logic error:", error);
        return false;
    }
}
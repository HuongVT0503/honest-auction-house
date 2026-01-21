import * as snarkjs from "snarkjs";
import fs from "fs";
import path from "path";

//load the key once at startup
const vKeyPath = path.join(__dirname, "../verification_key.json");
const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf-8"));

export async function verifyBidProof(proof: any, publicSignals: any) {
    try {
        //verify proof using verification key
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        return isValid;
    } catch (error) {
        console.error("Verification failed:", error);
        return false;
    }
}
# 🔐 Deep Dive: ZK Circuits & Cryptography

This document explains the Zero-Knowledge Proof (ZKP) architecture used in the **Honest Auction House**. I use **Circom 2.0** for circuit definition and **SnarkJS** for proof generation and verification.

## 1. The Circuit Logic (`bid_check.circom`)

The core of our privacy relies on the `BidCheck` template. It proves that a user knows a `secret` and an `amount` that hash to a specific `commitment`, without revealing the `amount` or `secret`.

1. Private Inputs: `amount`, `secret`
2. Public Inputs: `auctionId`, `commitment`
3. Constraints:
* Range Check: `amount` must fit in 64 bits (prevents negative number attacks).
* Integrity: `Poseidon(amount, secret, auctionId) === commitment`.

### The Code Explained

```circom
pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template BidCheck() {
    // 1. Private Inputs (The Secrets)
    // These values are known ONLY to the user generating the proof.
    signal input amount;
    signal input secret;

    // 2. Public Inputs (The Constraints)
    // These are known by the server (Verifier).
    signal input auctionId;
    signal input commitment;

    // 3. Negative Number Prevention (Security Patch)
    // I enforce that 'amount' fits in 64 bits. This prevents attackers 
    // from using finite field wrapping to submit negative bids (e.g., -1).
    component rangeCheck = Num2Bits(64);
    rangeCheck.in <== amount;

    // 4. Integrity Check (Poseidon Hash)
    // I calculate the hash of the private + public inputs.
    component hasher = Poseidon(3);
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== secret;
    hasher.inputs[2] <== auctionId; // Binds the proof to a specific auction (Replay Protection)

    // 5. The Constraint
    // The calculated hash MUST match the public 'commitment'.
    commitment === hasher.out;
}

// Public inputs are exposed in the verification_key.json and proof
component main {public [auctionId, commitment]} = BidCheck();
```
### Why these components?

* **Poseidon Hash:** A ZK-friendly hashing algorithm that is much more efficient inside circuits than SHA-256.
* **Replay Protection:** By including `auctionId` in the hash, a valid proof for Auction #1 cannot be "replayed" by an attacker on Auction #2.
* **Range Check:** Finite fields work in modulo arithmetic. Without `Num2Bits(64)`, a number like `-1` could be interpreted as a massive integer, allowing a malicious user to win every auction.

---

## 2. The Trusted Setup (Ceremony)

ZKP systems like Groth16 require a "Trusted Setup" to generate the proving and verification keys. This is a multi-step process.

### Phase 1: Powers of Tau (Universal)
This phase is generic and can be reused for any circuit. It generates the `pot12_final.ptau` file.

### Phase 2: Circuit Specific (The "Ceremony")
I generate keys specific to `bid_check.circom`.

1.  **Compile Circuit:** Converts `.circom` to `.r1cs` (Constraint System) and `.wasm` (for browser witness generation).
    ```bash
    circom bid_check.circom --r1cs --wasm --sym
    ```

2.  **Setup Groth16:** Generates the initial ZKey.
    ```bash
    snarkjs groth16 setup bid_check.r1cs pot12_final.ptau bid_check_0000.zkey
    ```

3.  **Contribute Randomness:** This is the "Ceremony." You contribute entropy so no single party knows the "toxic waste" (secret parameters).
    ```bash
    snarkjs zkey contribute bid_check_0000.zkey bid_check_final.zkey --name="YourName" -v
    ```

4.  **Export Keys:**
    * `verification_key.json`: Sent to the **Server** to verify proofs.
    * `bid_check_final.zkey`: Sent to the **Client** to generate proofs.

---

## 3. Proof Lifecycle

### Client Side (Prover)
1.  **User enters** `10 ETH` (Amount) and `12345` (Secret).
2.  **App calculates** `Commitment = Poseidon(10, 12345, auctionID)`.
3.  **snarkjs** uses the `.wasm` file to calculate the "witness" (all intermediate circuit values).
4.  **snarkjs** uses the `.zkey` to generate the `proof` and `publicSignals`.
5.  **Client sends** `proof` + `publicSignals` to API.

### Server Side (Verifier)
1.  **Server receives** the proof.
2.  **Server loads** `verification_key.json`.
3.  **Server runs** `snarkjs.groth16.verify(vKey, publicSignals, proof)`.
4.  If true, the server trusts that the user knows the secret values behind the commitment, **without ever seeing them**.
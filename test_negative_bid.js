const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");
const path = require("path");
const fs = require("fs");

async function testNegativeBid() {
    console.log("🧪 STARTING NEGATIVE BID TEST...");

    const WASM_PATH = path.join(__dirname, "circuits/bid_check_js/bid_check.wasm");
    const ZKEY_PATH = path.join(__dirname, "circuits/bid_check_final.zkey");

    if (!fs.existsSync(WASM_PATH) || !fs.existsSync(ZKEY_PATH)) {
        console.error("❌ Error: Compile your circuits first!");
        console.error(`Missing: ${WASM_PATH} or ${ZKEY_PATH}`);
        return;
    }

    const poseidon = await buildPoseidon();
    
    //The Attack: using -1
    //in the finite field (Bn128), -1 wraps around to:
    // 21888242871839275222246405745257275088548364400416034343698204186575808495616
    const amount = BigInt(-1); 
    const secret = BigInt(12345);
    const auctionId = BigInt(1);

    //calculate Ccmmitment manually (attacker does this correctly)
    const hashBytes = poseidon([amount, secret, auctionId]);
    const commitment = poseidon.F.toString(hashBytes);

    console.log("😈 Attacking with Amount: -1");
    console.log("📝 Calculated Commitment:", commitment);

    //attempt to gen proof
    const input = {
        amount: amount.toString(),
        secret: secret.toString(),
        auctionId: auctionId.toString(),
        commitment: commitment
    };

    try {
        await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
        console.log("❌ FAILURE: The circuit ACCEPTED the negative number! (Fix didn't work)");
    } catch (error) {
        console.log("\n✅ SUCCESS: The circuit REJECTED the negative number.");
        console.log("Reason:", error.message.split('\n')[0]); // Usually "Error: Assert Failed" or similar witness error
    }
}

testNegativeBid();

//run: node test_negative_bid.js
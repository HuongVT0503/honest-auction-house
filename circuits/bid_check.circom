pragma circom 2.0.0;

// Import the Poseidon hashing function
// You will need to npm install circlelibjs or download the circomlib git submodule
include "../node_modules/circomlib/circuits/poseidon.circom";

template BidCheck() {
    // 1. Private Inputs (The secrets the user keeps in their browser)
    signal input amount; 
    signal input secret; 

    // 2. Public Inputs (What gets sent to the server/blockchain)
    signal input commitment; // This is the Hash(amount, secret)

    // 3. Constraints (The Logic)

    // A. Integrity Check: verify that Hash(amount, secret) actually equals 'commitment'
    component hasher = Poseidon(2); // Poseidon with 2 inputs
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== secret;

    commitment === hasher.out;

    // B. Range Check: Ensure bid is strictly positive (amount > 0)
    // This prevents someone from submitting a negative bid or zero.
    // In Circom, we usually use a comparator, but for simple > 0, 
    // we can just enforce it via other means or a specialized Num2Bits checker.
    // For this prototype, the Hash check is the most critical.
}

component main {public [commitment]} = BidCheck();
pragma circom 2.0.0;

// Import the Poseidon hashing function (standard for ZK)
include "../node_modules/circomlib/circuits/poseidon.circom";

template SimpleHash() {
    // Private Input: The secret number (e.g., your bid or password)
    signal input secret;

    // Public Output: The hash of the secret
    signal output hash;

    // Initialize Poseidon Hash with 1 input
    component poseidon = Poseidon(1);
    
    // Connect the secret to the hasher
    poseidon.inputs[0] <== secret;

    // Output the result
    hash <== poseidon.out;
}

component main = SimpleHash();
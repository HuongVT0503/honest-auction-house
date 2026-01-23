pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template BidCheck() {
    //private inputs
    signal input amount;
    signal input secret; 

    //public inputs
    signal input auctionId;
    signal input commitment;

    component rangeCheck = Num2Bits(64); //prevents input negative numbers
    rangeCheck.in <== amount;

    //constraints/intergrity check
    component hasher = Poseidon(3); 
    hasher.inputs[0] <== amount;
    hasher.inputs[1] <== secret;
    hasher.inputs[2] <== auctionId; 

    commitment === hasher.out;
}

//auctionId must be public->verifier(server) knows which auction this is for
component main {public [commitment, auctionId]} = BidCheck();
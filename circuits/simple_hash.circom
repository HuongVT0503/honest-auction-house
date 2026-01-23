pragma circom 2.0.0;

//import Poseidon hashing function (standard for ZK)
include "../node_modules/circomlib/circuits/poseidon.circom";

template SimpleHash() {
    //private input: the secret number (vd ur bid or pwd)
    signal input secret;

    //public output: hash of the secret
    signal output hash;

    //init Poseidon Hash w 1 input
    component poseidon = Poseidon(1);
    
    //connect secret to hasher
    poseidon.inputs[0] <== secret;

    //output result
    hash <== poseidon.out;
}

component main = SimpleHash();
//dynamically import circomlibjs-> handle ESM/CommonJS compatibility
const circomlibjs = import('circomlibjs');

export async function getPoseidonHash(
    amount: string | number,
    secret: string | number,
    auctionId: string | number
): Promise<string> {

    try {
        BigInt(amount);
        BigInt(secret);
        BigInt(auctionId);
    } catch (e) {
        throw new Error("Hashing Error: Inputs must be numeric values convertible to BigInt.");
    }

    //hash
    const { buildPoseidon } = await circomlibjs;
    const poseidon = await buildPoseidon();

    // BigInt conversion b4 passing to Poseidon
    const hashBytes = poseidon([
        BigInt(amount),
        BigInt(secret),
        BigInt(auctionId)
    ]);

    return poseidon.F.toString(hashBytes);
}
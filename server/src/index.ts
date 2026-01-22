import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { verifyBidProof } from './utils/verifier';
import bcrypt from 'bcryptjs';
import path from 'path';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(express.json());

async function getPoseidonHash(amount: any, secret: any) {
    const { buildPoseidon } = await import('circomlibjs'); // Dynamic import for CommonJS
    const poseidon = await buildPoseidon();
    const hashBytes = poseidon([BigInt(amount), BigInt(secret)]);
    return poseidon.F.toString(hashBytes);
}


//USER ROUTES

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword
            }
        });

        res.json({ id: user.id, username: user.username });
    } catch (error) {
        res.status(400).json({ error: 'Username likely taken' });
    }
});

// Login (Mock implementation for prototype)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    //VERIFICATION: plaintext input vs stored hash
    const isValid = await bcrypt.compare(password, user.password);

    if (isValid) {
        res.json({ success: true, userId: user.id, username: user.username });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

//AUCTION ROUTES

//create an auction
app.post('/auctions', async (req, res) => {
    try {
        const { title, description, sellerId, durationMinutes } = req.body;

        const endsAt = new Date();
        endsAt.setMinutes(endsAt.getMinutes() + durationMinutes);

        const auction = await prisma.auction.create({
            data: {
                title,
                description,
                sellerId,
                endsAt,
                status: "OPEN"
            }
        });
        res.json(auction);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create auction' });
    }
});

//list all open auctions
app.get('/auctions', async (req, res) => {
    try {
        const now = new Date();

        //LAZY UPDATE: auto flip expired OPEN auctions to REVEAL
        //runs every time s.o loads the dashboard
        await prisma.auction.updateMany({
            where: {
                status: "OPEN",
                endsAt: { lte: now }
            },
            data: {
                status: "REVEAL"
            }
        });

        //fetch the updated list
        const auctions = await prisma.auction.findMany({
            where: { OR: [{ status: "OPEN" }, { status: "REVEAL" }] },
            orderBy: { createdAt: 'desc' },
            include: { seller: { select: { username: true } } }
        });

        res.json(auctions);
    } catch (error) {
        console.error("Error fetching auctions:", error);
        res.status(500).json({ error: 'Failed to fetch auctions' });
    }
});

//place a Sealed Bid
app.post('/bid', async (req, res) => {
    try {
        const { auctionId, bidderId, proof, publicSignals } = req.body;

        const auction = await prisma.auction.findUnique({
            where: { id: Number(auctionId) }
        });

        if (!auction) {
            return res.status(404).json({ error: "Auction not found" });
        }

        if (new Date() > auction.endsAt || auction.status !== "OPEN") {
            return res.status(400).json({ error: "Auction has ended. No new bids allowed." });
        }

        //verify ZK proof
        // publicSignals[0] is the 'commitment' (Poseidon hash output) from the circuit
        const isValid = await verifyBidProof(proof, publicSignals);

        if (!isValid) {
            res.status(400).json({ error: 'Invalid ZK Proof. Integrity check failed.' });
            return;
        }

        const commitment = publicSignals[0];

        //save commitment
        //NOT save the amount or secret yet. Just the hash.
        const bid = await prisma.bid.create({
            data: {
                auctionId: Number(auctionId),
                bidderId: Number(bidderId),
                commitment: commitment,
                // amount and secret remain null until reveal phase
            }
        });

        res.json({ success: true, bidId: bid.id, commitment });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to place bid' });
    }
});

//Reveal
app.post('/bid/reveal', async (req, res) => {
    try {
        const { auctionId, bidderId, amount, secret } = req.body;

        //find the sealed bid using composite key
        const bid = await prisma.bid.findUnique({
            where: {
                auctionId_bidderId: {
                    auctionId: Number(auctionId),
                    bidderId: Number(bidderId)
                }
            }
        });

        if (!bid) return res.status(404).json({ error: "Bid not found" });
        if (bid.amount !== null) return res.status(400).json({ error: "Already revealed" });

        //verify the inputs match the commitment on the blockchain/DB
        //replicate the circuit logic: Commitment = Poseidon(amount, secret)
        const calculatedHash = await getPoseidonHash(amount, secret);

        if (calculatedHash !== bid.commitment) {
            return res.status(400).json({ error: "Invalid secret or amount! Hash mismatch." });
        }

        //if valid, update the bid with the real values
        await prisma.bid.update({
            where: { id: bid.id },
            data: {
                amount: Number(amount),
                secret: String(secret)
            }
        });

        res.json({ success: true, message: "Bid revealed successfully!" });

    } catch (error) {
        console.error("Reveal error:", error);
        res.status(500).json({ error: 'Failed to reveal bid' });
    }
});

// Health Check
app.get('/', (req, res) => {
    res.send('Honest Auction House Backend is Running & Connected to DB!');
});

app.post('/auctions/:id/close', async (req, res) => {
    try {
        const { id } = req.params;

        //fetch auction and revealed bids
        const auction = await prisma.auction.findUnique({
            where: { id: Number(id) },
            include: { bids: true }
        });

        if (!auction) return res.status(404).json({ error: "Auction not found" });

        //filter for VALID REVEALED bids (amount is not null)
        const validBids = auction.bids
            .filter(b => b.amount !== null)
            .sort((a, b) => (b.amount || 0) - (a.amount || 0)); // Sort Descending

        //Determine Winner
        let winnerId = null;
        if (validBids.length > 0) {
            winnerId = validBids[0].bidderId;
        }

        // 4. Update Auction State
        const updatedAuction = await prisma.auction.update({
            where: { id: Number(id) },
            data: {
                status: "CLOSED",
                winnerId: winnerId
            },
            include: { winner: { select: { username: true } } }
        });

        res.json({
            success: true,
            winner: updatedAuction.winner?.username || "No valid bids",
            winningAmount: validBids[0]?.amount || 0
        });

    } catch (error) {
        console.error("Error closing auction:", error);
        res.status(500).json({ error: 'Failed to close auction' });
    }
});

const frontendPath = path.join(__dirname, "../public");
app.use(express.static(frontendPath));

app.get(/(.*)/, (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/bid') || req.path.startsWith('/auctions')) {
        return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
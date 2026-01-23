import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { verifyBidProof } from './utils/verifier';
import bcrypt from 'bcryptjs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin, AuthRequest } from './middleware/auth';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_in_prod';

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(express.json());

async function getPoseidonHash(amount: any, secret: any, auctionId: any) {
    const { buildPoseidon } = await import('circomlibjs');
    const poseidon = await buildPoseidon();
    const hashBytes = poseidon([BigInt(amount), BigInt(secret), BigInt(auctionId)]);
    return poseidon.F.toString(hashBytes);
}

//AUTH ROUTES

app.post('/register', async (req, res) => {
    try {
        const { username, password, isAdmin, adminSecret } = req.body; // Check for admin flag
        const hashedPassword = await bcrypt.hash(password, 10);

        //Require a secret to register as admin
        const role = (isAdmin && adminSecret === process.env.ADMIN_SECRET) ? 'ADMIN' : 'USER';

        const user = await prisma.user.create({
            data: { username, password: hashedPassword, role }
        });

        //autologin: generate token immediately
        const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(400).json({ error: 'Username taken or invalid data' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

//ADMIN ROUTES

//create auction 
app.post('/auctions', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { title, description, durationMinutes } = req.body;
        // sellerId is the logged-in admin
        const sellerId = req.user!.userId;

        const endsAt = new Date();
        endsAt.setMinutes(endsAt.getMinutes() + durationMinutes);

        const auction = await prisma.auction.create({
            data: { title, description, sellerId, endsAt, status: "OPEN" }
        });
        res.json(auction);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create auction' });
    }
});

//USER ROUTES

//login
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

//get own bids history
app.get('/me/bids', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const bids = await prisma.bid.findMany({
            where: { bidderId: req.user!.userId },
            include: { auction: true }, // Include auction details
            orderBy: { createdAt: 'desc' }
        });
        res.json(bids);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

//AUCTION ROUTES

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
app.post('/bid', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { auctionId, proof, publicSignals } = req.body;
        const bidderId = req.user!.userId;

        const auction = await prisma.auction.findUnique({
            where: { id: Number(auctionId) }
        });

        if (!auction) {
            return res.status(404).json({ error: "Auction not found" });
        }

        if (new Date() > auction.endsAt || auction.status !== "OPEN") {
            return res.status(400).json({ error: "Auction has ended. No new bids allowed." });
        }

        //REPLAY ATTACK
        //publicSignals[0] = commitment
        //publicSignals[1] = auctionId
        const proofAuctionId = publicSignals[1];

        //verify proof was gen specifically for THIS auction
        if (proofAuctionId !== String(auctionId)) {
            return res.status(400).json({ error: "Invalid Proof: Auction ID mismatch (Replay Attack Attempt?)" });
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
        const calculatedHash = await getPoseidonHash(amount, secret, auctionId);

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


app.post('/admin/reset', async (req, res) => {
    try {
        const { password } = req.body;
        if (password !== "admin_reset_123") {
            return res.status(403).json({ error: "Unauthorized" });
        }

        await prisma.bid.deleteMany({});
        await prisma.auction.deleteMany({});
        //?keeop users
        // await prisma.user.deleteMany({}); 

        res.json({ success: true, message: "All auctions and bids wiped." });
    } catch (error) {
        console.error("Reset failed:", error);
        res.status(500).json({ error: "Failed to reset database" });
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
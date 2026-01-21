import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { verifyBidProof } from './utils/verifier';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//USER ROUTES

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        // In production, hash the password (e.g., bcrypt)!
        const user = await prisma.user.create({
            data: { username, password }
        });
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: 'Username likely taken' });
    }
});

// Login (Mock implementation for prototype)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (user && user.password === password) {
        res.json({ success: true, userId: user.id });
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
    const auctions = await prisma.auction.findMany({
        where: { status: "OPEN" },
        include: { seller: { select: { username: true } } }
    });
    res.json(auctions);
});

//place a Sealed Bid
app.post('/bid', async (req, res) => {
    try {
        const { auctionId, bidderId, proof, publicSignals } = req.body;

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

// Health Check
app.get('/', (req, res) => {
    res.send('Honest Auction House Backend is Running & Connected to DB!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
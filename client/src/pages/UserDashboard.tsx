import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { generateBidProof } from "../lib/snark-utils";
import type { Auction, BidHistory } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function UserDashboard() {
    const { user, token, logout } = useAuth();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [history, setHistory] = useState<BidHistory[]>([]);
    const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
    const [amount, setAmount] = useState<number>(0);
    const [secret, setSecret] = useState<string>("");
    const [status, setStatus] = useState("Idle");

    const authHeaders = useMemo(() => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    }), [token]);

    const fetchAuctions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auctions`, { headers: authHeaders });
            const data = await res.json();
            setAuctions(data);
        } catch (e) {
            console.error("Failed to fetch auctions", e);
        }
    }, [authHeaders]);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/me/bids`, { headers: authHeaders });
            const data = await res.json();
            setHistory(data);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [authHeaders]);

    //init load
    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (isMounted) {
                await fetchAuctions();
                fetchHistory();
            }
        };
        loadData();

        const interval = setInterval(() => {
            if (isMounted) fetchAuctions();
        }, 10000); //every 10s

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [fetchAuctions, fetchHistory]);

    const handleBid = async () => {
        if (!selectedAuction || !user) return;
        setStatus("Generating Zero Knowledge Proof...");

        //save secret locally so user doesn't forget it
        const bidData = { amount, secret };
        localStorage.setItem(`bid_${selectedAuction.id}_${user.id}`, JSON.stringify(bidData));

        try {
            //gen ZK Proof in browser
            const { proof, publicSignals } = await generateBidProof(amount, secret, selectedAuction.id);
            setStatus("Proof generated! Sending to server...");

            //send to be
            const res = await fetch(`${API_URL}/bid`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    auctionId: selectedAuction.id,
                    proof,
                    publicSignals,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`Bid Placed! Commitment: ${data.commitment.slice(0, 10)}...`);
                fetchHistory(); //refresh history
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            setStatus("Failed to place bid.");
        }
    };

    const handleReveal = async () => {
        if (!selectedAuction || !user) return;
        setStatus("Revealing Bid...");
        try {
            const res = await fetch(`${API_URL}/bid/reveal`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    auctionId: selectedAuction.id,
                    amount: amount,
                    secret: secret,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus("Success! Bid Revealed.");
                fetchAuctions();
                fetchHistory();
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            setStatus("Reveal failed.");
        }
    };

    const handleCloseAuction = async () => {
        if (!selectedAuction) return;
        setStatus("Closing Auction...");
        try {
            const res = await fetch(`${API_URL}/auctions/${selectedAuction.id}/close`, {
                method: "POST",
                headers: authHeaders,
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`Auction Closed! Winner: ${data.winner} ($${data.winningAmount})`);
                fetchAuctions();
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            setStatus("Failed to close auction.");
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'OPEN': return 'status-open';
            case 'REVEAL': return 'status-reveal';
            default: return 'status-closed';
        }
    };

    return (
        <div className="app-container">
            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <h1 className="header-title">Honest Auction House</h1>
                    <span className="text-sub">User Dashboard</span>
                </div>
                <div className="header-user">
                    <span>Welcome, <strong>{user?.username}</strong></span>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            {/* Main Content Area */}
            {!selectedAuction ? (
                <div className="dashboard-grid">

                    {/* Left Column: Active Auctions */}
                    <div className="card">
                        <h2>Active Auctions</h2>

                        {auctions.length === 0 && <p>No active auctions found.</p>}
                        {auctions.map(auc => (
                            <div key={auc.id} className="auction-item">
                                <div className="auction-header">
                                    <h3>{auc.title}</h3>
                                    <span className="seller-badge">
                                        Seller: {auc.seller.username}
                                    </span>
                                </div>
                                <p>Status: <strong className={getStatusClass(auc.status)}>{auc.status}</strong></p>

                                {auc.status === "OPEN" && (
                                    <div className="auction-timer-warning">
                                        ⏳ Ends: {new Date(auc.endsAt).toLocaleTimeString()}
                                        <br />
                                        <small>(Refreshes automatically)</small>
                                    </div>
                                )}

                                <button onClick={() => setSelectedAuction(auc)} className="mt-10 w-100">
                                    {auc.status === "OPEN" ? "Place Bid" : "Reveal Bid / View"}
                                </button>
                            </div>
                        ))}
                        <button onClick={fetchAuctions} className="mt-20">Refresh List</button>
                    </div>

                    {/* Right Column: History */}
                    <div className="card">
                        <h3>My Bid History</h3>
                        <div className="history-list">
                            {history.length === 0 && <p className="text-grey">No bids placed yet.</p>}

                            {history.map(bid => (
                                <div key={bid.id} className="history-item">
                                    <strong>{bid.auction.title}</strong>
                                    <br />
                                    {bid.amount ? (
                                        <span className="text-green">Revealed: ${bid.amount}</span>
                                    ) : (
                                        <span className="text-gold">🔒 Sealed Bid</span>
                                    )}
                                    <br />
                                    <small className="text-grey">{new Date(bid.createdAt).toLocaleDateString()}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                /* Single Auction View */
                <div className="card single-view-container">
                    <button onClick={() => { setSelectedAuction(null); setStatus("Idle"); }} className="mb-10">
                        ← Back to List
                    </button>

                    <h2>{selectedAuction.title}</h2>
                    <p>Current Phase: <strong>{selectedAuction.status}</strong></p>

                    <div className="bid-form">
                        <label className="text-left">Bid Amount (ETH)</label>
                        <input
                            type="number"
                            placeholder="Amount"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                        />

                        <label className="text-left">Secret (Keep this safe!)</label>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Secret key"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                            <button
                                className="btn-random"
                                onClick={() => setSecret(Math.floor(Math.random() * 100000).toString())}
                            >
                                🎲 Random
                            </button>
                        </div>

                        {/* Conditional Buttons based on Status */}
                        {selectedAuction.status === "OPEN" ? (
                            <button onClick={handleBid} className="primary-btn">
                                Generate Zero-Knowledge Proof & Bid
                            </button>
                        ) : selectedAuction.status === "REVEAL" ? (
                            <>
                                <div className="reveal-actions">
                                    <button onClick={() => {
                                        const saved = localStorage.getItem(`bid_${selectedAuction.id}_${user?.id}`);
                                        if (saved) {
                                            const { amount, secret } = JSON.parse(saved);
                                            setAmount(amount);
                                            setSecret(secret);
                                            setStatus("Restored secret from browser storage!");
                                        } else {
                                            setStatus("No saved bid found on this device.");
                                        }
                                    }} className="flex-1">
                                        📂 Load My Secret
                                    </button>

                                    <button onClick={handleReveal} className="btn-reveal flex-1">
                                        Reveal My Bid
                                    </button>
                                </div>

                                {/* Seller Zone - Only visible if current user is the seller */}
                                {selectedAuction.seller.username === user?.username && (
                                    <div className="seller-zone">
                                        <p className="seller-label">👑 Seller Zone</p>
                                        <button onClick={handleCloseAuction} className="btn-close-auction w-100">
                                            🏆 End Auction & Pick Winner
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="winner-banner">
                                <h3>🏁 Auction Closed</h3>
                            </div>
                        )}
                    </div>

                    <div className="status-bar">
                        Status: <strong>{status}</strong>
                    </div>
                </div>
            )}
        </div>
    );
}
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { generateBidProof } from "../lib/snark-utils";
import AuctionTimer from "../components/AuctionTimer";
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

    const [newTitle, setNewTitle] = useState('');
    const [newDuration, setNewDuration] = useState(10);
    const [isCreating, setIsCreating] = useState(false);

    const authHeaders = useMemo(() => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    }), [token]);

    const fetchAuctions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/auctions`, { headers: authHeaders });
            const data = await res.json();
            setAuctions(data);

            setSelectedAuction(currentSelected => {
                if (!currentSelected) return null;

                const fresh = data.find((a: Auction) => a.id === currentSelected.id);
                return fresh || currentSelected;
            });

        } catch (e) {
            console.error("Failed to fetch auctions", e);
        }
    }, [authHeaders]); // You can also remove 'selectedAuction' from the dependency array now

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/me/bids`, { headers: authHeaders });
            const data = await res.json();
            setHistory(data);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [authHeaders]);

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
        }, 10000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [fetchAuctions, fetchHistory]);

    const createAuction = async () => {
        if (!newTitle) return alert("Title required");

        try {
            await fetch(`${API_URL}/auctions`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ title: newTitle, durationMinutes: newDuration })
            });
            alert("Auction Created!");
            setNewTitle('');
            setIsCreating(false);
            fetchAuctions();
        } catch (e) {
            console.error(e);
            alert("Failed to create auction");
        }
    };

    const handleBid = async () => {
        if (!selectedAuction || !user) return;
        setStatus("Generating Zero Knowledge Proof...");

        const bidData = { amount, secret };
        localStorage.setItem(`bid_${selectedAuction.id}_${user.id}`, JSON.stringify(bidData));

        try {
            const { proof, publicSignals } = await generateBidProof(amount, secret, selectedAuction.id);
            setStatus("Proof generated! Sending to server...");

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
                fetchHistory();
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

        if (selectedAuction.status === 'CLOSED') {
            setStatus("Auction is already closed.");
            return;
        }

        // if trying to close during OPEN phase (skips reveal)
        if (selectedAuction.status === 'OPEN') {
            if (!confirm("Warning: Closing now will skip the Reveal phase and no bids will be valid. Are you sure?")) {
                return;
            }
        }

        setStatus("Closing Auction...");
        try {
            const res = await fetch(`${API_URL}/auctions/${selectedAuction.id}/close`, {
                method: "POST",
                headers: authHeaders,
            });
            const data = await res.json();
            if (res.ok) {
                const winnerMsg = data.winner
                    ? `Winner: ${data.winner} ($${data.winningAmount})`
                    : "No valid bids revealed.";

                setStatus(`Auction Closed! ${winnerMsg}`);

                // Immediately update local state to reflect change without waiting for re-fetch
                setSelectedAuction(prev => prev ? { ...prev, status: 'CLOSED' } : null);
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
                        <div className="auction-header header-active-auctions">
                            <h2>Active Auctions</h2>
                            <button onClick={() => setIsCreating(!isCreating)}>
                                {isCreating ? 'Cancel' : '+ Create Auction'}
                            </button>
                        </div>

                        {/* Creation Form */}
                        {isCreating && (
                            <div className="bid-form create-auction-box">
                                <h4>New Auction</h4>
                                <input placeholder="Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                                <label>Duration (Minutes):
                                    <input type="number" value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} />
                                </label>
                                <small className="text-sub">Bidding: {newDuration * 0.9}m | Reveal: {newDuration * 0.1}m</small>
                                <button onClick={createAuction}>Start Auction</button>
                            </div>
                        )}

                        {auctions.length === 0 && <p>No active auctions found.</p>}
                        {auctions.map(auc => (
                            <div key={auc.id} className="auction-item">
                                <div className="auction-header">
                                    <h3>
                                        {auc.title}
                                        <AuctionTimer
                                            createdAt={auc.createdAt}
                                            durationMinutes={auc.durationMinutes}
                                            status={auc.status}
                                            onPhaseChange={fetchAuctions}
                                        />
                                    </h3>
                                    <span className="seller-badge">
                                        Seller: {auc.seller.username}
                                    </span>
                                </div>
                                <p>Status: <strong className={getStatusClass(auc.status)}>{auc.status}</strong></p>

                                <button onClick={() => setSelectedAuction(auc)} className="mt-10 w-100">
                                    {auc.seller.username === user?.username
                                        ? "Manage Auction"
                                        : (auc.status === "OPEN" ? "Place Bid" : "View Auction")
                                    }
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

                        {/* 1. BIDDING PHASE */}
                        {selectedAuction.status === "OPEN" && selectedAuction.seller.username !== user?.username && (
                            <>
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
                                <button onClick={handleBid} className="primary-btn mt-20">
                                    Generate Zero-Knowledge Proof & Bid
                                </button>
                            </>
                        )}

                        {/* 2. REVEAL PHASE */}
                        {selectedAuction.status === "REVEAL" && (
                            <>
                                <p className="text-gold">⚠ Bidding Closed. Verify your secret to reveal your bid.</p>
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
                                </div>

                                <label htmlFor="reveal-secret" className="text-left">Secret Used for Bid</label>
                                <input
                                    id="reveal-secret"
                                    type="text"
                                    value={secret}
                                    onChange={(e) => setSecret(e.target.value)}
                                />
                                <label htmlFor="reveal-amount" className="text-left">Amount Bid</label>
                                <input
                                    id="reveal-amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                />

                                <button onClick={handleReveal} className="btn-reveal w-100 mt-10">
                                    Reveal My Bid
                                </button>
                            </>
                        )}

                        {/* 3. CLOSED PHASE */}
                        {selectedAuction.status === "CLOSED" && (
                            <div className="winner-banner">
                                <h3>🏁 Auction Closed</h3>
                                {selectedAuction.winner ? (
                                    <div className="text-green">
                                        <h4>Winner: {selectedAuction.winner.username}</h4>
                                        <p className="winning-amount">
                                            Winning Bid: ${selectedAuction.winningAmount} ETH
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-gold">No valid bids revealed.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SELLER ZONE - Always visible to owner */}
                    {selectedAuction.seller.username === user?.username && (
                        <div className="seller-zone">
                            <p className="seller-label">👑 Seller Zone</p>
                            <button
                                onClick={handleCloseAuction}
                                className="btn-close-auction w-100"
                                disabled={selectedAuction.status === 'CLOSED'}
                            >
                                {selectedAuction.status === 'OPEN' ? "Wait for Reveal Phase (or Force Close)" :
                                    selectedAuction.status === 'REVEAL' ? "🏆 End Auction & Pick Winner" :
                                        "✅ Auction Finalized"}
                            </button>
                            {selectedAuction.status === 'OPEN' && (
                                <small className="warning-text-orange">
                                    (Warning: Closing now skips Reveal phase)
                                </small>
                            )}
                        </div>
                    )}

                    <div className="status-bar">
                        Status: <strong>{status}</strong>
                    </div>
                </div>
            )}
        </div>
    );
}
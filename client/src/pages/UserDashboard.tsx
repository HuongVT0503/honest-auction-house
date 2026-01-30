import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { generateBidProof } from "../lib/snark-utils";
import AuctionTimer from "../components/AuctionTimer";
import type { Auction, BidHistory, LocalBid, User } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type TabType = 'market' | 'selling' | 'bidding' | 'won';

//sub components

const SectionDivider = ({ title }: { title: string }) => (
    <h4 className="mt-4 mb-2 text-sub section-divider">
        {title}
    </h4>
);

interface AuctionCardProps {
    auction: Auction;
    user: User | null;
    onSelect: (auction: Auction) => void;
    onPhaseChange: () => void;
}

const AuctionCard = ({ auction, user, onSelect, onPhaseChange }: AuctionCardProps) => {
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'OPEN': return 'status-badge status-open';
            case 'REVEAL': return 'status-badge status-reveal';
            default: return 'status-badge status-closed';
        }
    };

    return (
        <div className="auction-item">
            <div className="auction-header">
                <h3>{auction.title}</h3>
                <span className={getStatusClass(auction.status)}>{auction.status}</span>
            </div>
            <div className="auction-meta mb-10">
                <span className="mono-font">Seller: {auction.seller.username}</span>
                <span>•</span>
                <AuctionTimer
                    createdAt={auction.createdAt}
                    durationMinutes={auction.durationMinutes}
                    status={auction.status}
                    onPhaseChange={onPhaseChange}
                />
            </div>
            {auction.winner && (
                <div className="text-green text-sm mb-4">
                    Winner: {auction.winner.username} ({auction.winningAmount} ETH)
                </div>
            )}
            <button onClick={() => onSelect(auction)} className="w-100">
                {auction.seller.username === user?.username
                    ? "Manage Auction"
                    : (auction.status === "OPEN" ? "Place Sealed Bid" : "View Details")
                }
            </button>
        </div>
    );
};

interface AuctionListProps {
    list: Auction[];
    emptyMsg: string;
    user: User | null;
    onSelect: (auction: Auction) => void;
    onPhaseChange: () => void;
}

const AuctionList = ({ list, emptyMsg, user, onSelect, onPhaseChange }: AuctionListProps) => (
    <div className="flex-column gap-4">
        {Array.isArray(list) && list.length === 0 && <p className="text-muted">{emptyMsg}</p>}
        {Array.isArray(list) && list.map(auc => (
            <AuctionCard
                key={auc.id}
                auction={auc}
                user={user}
                onSelect={onSelect}
                onPhaseChange={onPhaseChange}
            />
        ))}
    </div>
);

////
export default function UserDashboard() {
    const { user, token, logout } = useAuth();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [history, setHistory] = useState<BidHistory[]>([]);
    const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
    const [amount, setAmount] = useState<number>(0);
    const [secret, setSecret] = useState<string>("");
    const [status, setStatus] = useState("Idle");
    const [activeTab, setActiveTab] = useState<TabType>('market');

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
        }, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [fetchAuctions, fetchHistory]);

    //derive data for tabs
    const myAuctions = useMemo(() =>
        auctions.filter(a => a.seller.username === user?.username),
        [auctions, user]);

    const wonAuctions = useMemo(() =>
        auctions.filter(a => a.winner?.username === user?.username),
        [auctions, user]);

    const participatingAuctions = useMemo(() => {
        if (!Array.isArray(history)) return [];
        
        const myBidAuctionIds = new Set(history.map(h => h.auction.id));
        return auctions.filter(a =>
            myBidAuctionIds.has(a.id) &&
            a.seller.username !== user?.username &&
            a.winner?.username !== user?.username
        );
    }, [auctions, history, user]);

    const marketAuctions = useMemo(() =>
        auctions.filter(a => a.status !== 'CLOSED'),
        [auctions]);

    //

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
                const storageKey = `bids_${selectedAuction.id}_${user.id}`;

                let existingBids: LocalBid[] = [];
                try {
                    const stored = localStorage.getItem(storageKey);
                    if (stored) existingBids = JSON.parse(stored);
                } catch (e) {
                    console.error("Error parsing local bids:", e);
                }

                const newBid: LocalBid = {
                    amount: amount,
                    secret: secret,
                    commitment: data.commitment,
                    timestamp: Date.now()
                };
                existingBids.push(newBid);
                localStorage.setItem(storageKey, JSON.stringify(existingBids));

                const backupContent = `
HONEST AUCTION BACKUP
---------------------
Auction: ${selectedAuction.title} (ID: ${selectedAuction.id})
Amount: ${amount} ETH
Secret: ${secret}
Commitment: ${data.commitment}

KEEP THIS FILE SAFE! You need the Secret to reveal your bid.
            `;

                const blob = new Blob([backupContent], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bid-backup-${selectedAuction.id}-${Date.now()}.txt`;
                a.click();
                window.URL.revokeObjectURL(url);

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

    const handleExtendAuction = async () => {
        if (!selectedAuction) return;
        if (!confirm("This will extend the auction by 10 minutes to allow bidders to reveal. Proceed?")) return;

        setStatus("Extending Auction...");
        try {
            const res = await fetch(`${API_URL}/auctions/${selectedAuction.id}/extend`, {
                method: "POST",
                headers: authHeaders,
            });
            const data = await res.json();
            if (res.ok) {
                setStatus("Auction Extended!");
                fetchAuctions();
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
            setStatus("Failed to extend.");
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'OPEN': return 'status-badge status-open';
            case 'REVEAL': return 'status-badge status-reveal';
            default: return 'status-badge status-closed';
        }
    };

    return (
        <div className="app-container">
            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <h1 className="header-title">Honest Auction House</h1>
                    <span className="text-sub">ZKP Privacy-Preserving Bidding</span>
                </div>
                <div className="header-user">
                    <span className="mr-4">@{user?.username}</span>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            {/* Main Content Area */}
            {!selectedAuction ? (
                <div className="dashboard-grid">

                    {/* Left Column: Tabbed Interface */}
                    <div className="card">
                        <div className="section-header">
                            <div className="flex-row gap-2">
                                <button
                                    className={`btn-sm ${activeTab === 'market' ? 'primary-btn' : ''}`}
                                    onClick={() => setActiveTab('market')}
                                >
                                    Market
                                </button>
                                <button
                                    className={`btn-sm ${activeTab === 'selling' ? 'primary-btn' : ''}`}
                                    onClick={() => setActiveTab('selling')}
                                >
                                    My Listings
                                </button>
                                <button
                                    className={`btn-sm ${activeTab === 'bidding' ? 'primary-btn' : ''}`}
                                    onClick={() => setActiveTab('bidding')}
                                >
                                    Participating
                                </button>
                                <button
                                    className={`btn-sm ${activeTab === 'won' ? 'primary-btn' : ''}`}
                                    onClick={() => setActiveTab('won')}
                                >
                                    Won
                                </button>
                            </div>

                            {activeTab === 'selling' && (
                                <button onClick={() => setIsCreating(!isCreating)}>
                                    {isCreating ? 'Cancel' : '+ New'}
                                </button>
                            )}
                        </div>

                        {/* Creation Form (Only visible in selling tab) */}
                        {isCreating && activeTab === 'selling' && (
                            <div className="create-auction-box">
                                <h4 className="mb-10">Start New Auction</h4>
                                <div className="bid-form">
                                    <input
                                        placeholder="Item Title"
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                        aria-label="Auction Item Title"
                                    />
                                    <div>
                                        <label>Duration (Minutes)</label>
                                        <input
                                            type="number"
                                            placeholder="Duration"
                                            value={newDuration}
                                            onChange={e => setNewDuration(Number(e.target.value))}
                                            aria-label="Auction Duration"
                                        />
                                    </div>
                                    <small className="text-sub">Bidding: {newDuration * 0.9}m | Reveal: {newDuration * 0.1}m</small>
                                    <button onClick={createAuction} className="primary-btn">Launch Auction</button>
                                </div>
                            </div>
                        )}

                        {/* TAB CONTENT */}

                        {activeTab === 'market' && (
                            <>
                                <h3 className="mb-4">Active Market</h3>
                                <AuctionList
                                    list={marketAuctions}
                                    emptyMsg="No active auctions found in the market."
                                    user={user}
                                    onSelect={setSelectedAuction}
                                    onPhaseChange={fetchAuctions}
                                />
                            </>
                        )}

                        {activeTab === 'selling' && (
                            <>
                                <SectionDivider title="Active Listings" />
                                <AuctionList
                                    list={myAuctions.filter(a => a.status !== 'CLOSED')}
                                    emptyMsg="You have no active listings."
                                    user={user}
                                    onSelect={setSelectedAuction}
                                    onPhaseChange={fetchAuctions}
                                />

                                <SectionDivider title="Past Listings (Closed)" />
                                <AuctionList
                                    list={myAuctions.filter(a => a.status === 'CLOSED')}
                                    emptyMsg="No closed listings."
                                    user={user}
                                    onSelect={setSelectedAuction}
                                    onPhaseChange={fetchAuctions}
                                />
                            </>
                        )}

                        {activeTab === 'bidding' && (
                            <>
                                <SectionDivider title="Active Bids" />
                                <AuctionList
                                    list={participatingAuctions.filter(a => a.status !== 'CLOSED')}
                                    emptyMsg="You are not bidding on any active auctions."
                                    user={user}
                                    onSelect={setSelectedAuction}
                                    onPhaseChange={fetchAuctions}
                                />

                                <SectionDivider title="Past Participation" />
                                <AuctionList
                                    list={participatingAuctions.filter(a => a.status === 'CLOSED')}
                                    emptyMsg="No past auction history."
                                    user={user}
                                    onSelect={setSelectedAuction}
                                    onPhaseChange={fetchAuctions}
                                />
                            </>
                        )}

                        {activeTab === 'won' && (
                            <>
                                <h3 className="mb-4 text-green">🏆 Won Auctions</h3>
                                <AuctionList
                                    list={wonAuctions}
                                    emptyMsg="You haven't won any auctions yet."
                                    user={user}
                                    onSelect={setSelectedAuction}
                                    onPhaseChange={fetchAuctions}
                                />
                            </>
                        )}
                    </div>

                    {/* Right Column: Recent Activity Log */}
                    <div className="card">
                        <h3 className="mb-10">Recent Activity</h3>
                        <div className="history-list">
                            {history.length === 0 && <p className="text-muted">No bids placed yet.</p>}
                            {history.map(bid => (
                                <div key={bid.id} className="history-item">
                                    <div className="flex-between">
                                        <strong>{bid.auction.title}</strong>
                                        <small className="text-sub">{new Date(bid.createdAt).toLocaleDateString()}</small>
                                    </div>
                                    <div className="mt-10">
                                        {bid.amount ? (
                                            <span className="text-green">Revealed: {bid.amount} ETH</span>
                                        ) : (
                                            <span className="text-gold">🔒 Sealed Bid</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                /* Single Auction View */
                <div className="card single-view-container">
                    <button
                        onClick={() => { setSelectedAuction(null); setStatus("Idle"); }}
                        className="btn-text mb-10"
                    >
                        ← Back to Dashboard
                    </button>

                    <h2 className="font-large mb-2">{selectedAuction.title}</h2>
                    <div className="auction-meta mb-20">
                        <span className={getStatusClass(selectedAuction.status)}>{selectedAuction.status}</span>
                        <AuctionTimer
                            createdAt={selectedAuction.createdAt}
                            durationMinutes={selectedAuction.durationMinutes}
                            status={selectedAuction.status}
                            onPhaseChange={fetchAuctions}
                        />
                    </div>

                    <div className="bid-form">
                        {/* 1. BIDDING PHASE */}
                        {selectedAuction.status === "OPEN" && selectedAuction.seller.username !== user?.username && (
                            <>
                                <div>
                                    <label>Bid Amount (ETH)</label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                    />
                                </div>

                                <div>
                                    <label>Secret (Keep this safe!)</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            placeholder="Numeric Secret"
                                            value={secret}
                                            onChange={(e) => setSecret(e.target.value)}
                                        />
                                        <button
                                            className="btn-random"
                                            onClick={() => setSecret(Math.floor(Math.random() * 100000).toString())}
                                        >
                                            🎲
                                        </button>
                                    </div>
                                </div>

                                <button onClick={handleBid} className="primary-btn mt-10">
                                    🔒 Generate Proof & Submit Bid
                                </button>
                            </>
                        )}

                        {/* 2. REVEAL PHASE */}
                        {selectedAuction.status === "REVEAL" && (
                            <>
                                <p className="text-gold alert-warning">
                                    ⚠ Bidding Closed. Reveal your secret now.
                                </p>

                                <div className="reveal-actions">
                                    <button onClick={() => {
                                        const storageKey = `bids_${selectedAuction.id}_${user?.id}`;
                                        let foundBid: LocalBid | null = null;
                                        try {
                                            const stored = localStorage.getItem(storageKey);
                                            if (stored) {
                                                const savedBids: LocalBid[] = JSON.parse(stored);
                                                if (savedBids.length > 0) {
                                                    savedBids.sort((a, b) => b.amount - a.amount);
                                                    foundBid = savedBids[0];
                                                }
                                            }
                                        } catch (e) { console.error(e); }

                                        if (!foundBid) {
                                            /* Legacy fallback */
                                            const oldKey = `bid_${selectedAuction.id}_${user?.id}`;
                                            const oldSaved = localStorage.getItem(oldKey);
                                            if (oldSaved) foundBid = JSON.parse(oldSaved) as LocalBid;
                                        }

                                        if (foundBid) {
                                            setAmount(foundBid.amount);
                                            setSecret(foundBid.secret);
                                            setStatus(`Loaded secret for bid: ${foundBid.amount} ETH`);
                                        } else {
                                            setStatus("No saved bid found on this device.");
                                        }
                                    }} className="w-100">
                                        📂 Load Secret from LocalStorage
                                    </button>
                                </div>

                                <div>
                                    <label>Secret</label>
                                    <input
                                        type="text"
                                        placeholder="Numeric Secret"
                                        value={secret}
                                        onChange={(e) => setSecret(e.target.value)}
                                        aria-label="Bid Secret"
                                    />
                                </div>
                                <div>
                                    <label>Amount</label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        aria-label="Auction Item Title"
                                    />
                                </div>

                                <button onClick={handleReveal} className="btn-reveal w-100 mt-10">
                                    Reveal My Bid
                                </button>
                            </>
                        )}

                        {/* 3. CLOSED PHASE */}
                        {selectedAuction.status === "CLOSED" && (
                            <div className="winner-banner">
                                <h3>🏁 Auction Finalized</h3>
                                {selectedAuction.winner ? (
                                    <div className="text-green mt-10">
                                        <div className="text-sub">Winner</div>
                                        <div className="font-large font-bold">{selectedAuction.winner.username}</div>
                                        <div className="winner-pill mt-10">
                                            Sold for {selectedAuction.winningAmount} ETH
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gold mt-10">No valid bids revealed.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SELLER ZONE */}
                    {selectedAuction.seller.username === user?.username && (
                        <div className="seller-zone">
                            <p className="seller-label mb-10">👑 Seller Controls</p>

                            {selectedAuction.status === 'CLOSED' && !selectedAuction.winner && (
                                <button onClick={handleExtendAuction} className="btn-active w-100">
                                    ⏱ Extend Time (10 Mins)
                                </button>
                            )}

                            {selectedAuction.status !== 'CLOSED' && (
                                <p className="text-sub text-center">
                                    You cannot bid on your own auction.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="status-bar">
                        <div className="status-label">SYSTEM STATUS</div>
                        <strong>{status}</strong>
                    </div>
                </div>
            )}
        </div>
    );
}
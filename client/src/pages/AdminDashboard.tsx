import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import AuctionTimer from "../components/AuctionTimer";
import type { Auction, User, BidHistory } from '../types';
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function AdminDashboard() {
    const { token, logout } = useAuth();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [allBids, setAllBids] = useState<BidHistory[]>([]);
    const [view, setView] = useState<'auctions' | 'users' | 'bids'>('auctions');

    const headers = useMemo(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }), [token]);

    const fetchData = useCallback(async () => {
        try {
            const aucRes = await fetch(`${API_URL}/auctions`, { headers });
            setAuctions(await aucRes.json());

            const userRes = await fetch(`${API_URL}/admin/users`, { headers });
            setUsers(await userRes.json());

            const bidRes = await fetch(`${API_URL}/admin/bids`, { headers });
            setAllBids(await bidRes.json());
        } catch (e) {
            console.error("Admin fetch failed", e);
        }
    }, [headers]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const aucRes = await fetch(`${API_URL}/auctions`, { headers });
                setAuctions(await aucRes.json());

                const userRes = await fetch(`${API_URL}/admin/users`, { headers });
                setUsers(await userRes.json());

                const bidRes = await fetch(`${API_URL}/admin/bids`, { headers });
                setAllBids(await bidRes.json());
            } catch (e) {
                console.error("Admin fetch failed", e);
            }
        };

        loadData();
    }, [headers]);

    const handleReset = async () => {
        if (!confirm("⚠ CRITICAL WARNING ⚠\n\nThis will WIPE ALL database records (Auctions, Bids, etc).\n\nAre you sure?")) return;
        const res = await fetch(`${API_URL}/admin/reset`, {
            method: 'POST',
            headers
        });
        const data = await res.json();
        if (data.success) {
            alert("System Reset Complete.");
            fetchData();
        } else {
            alert("Error: " + data.error);
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
            <header className="dashboard-header">
                <div>
                    <h1 className="header-title">Admin Console</h1>
                    <span className="text-sub">System Oversight</span>
                </div>
                <div className="flex-center gap-4">
                    <button onClick={handleReset} className="btn-danger">⚠ Reset System</button>
                    <button onClick={logout}>Logout</button>
                </div>
            </header>

            <div className="flex-row gap-2 mb-4">
                <button onClick={() => setView('auctions')} className={view === 'auctions' ? 'primary-btn' : ''}>Auctions</button>
                <button onClick={() => setView('users')} className={view === 'users' ? 'primary-btn' : ''}>Users</button>
                <button onClick={() => setView('bids')} className={view === 'bids' ? 'primary-btn' : ''}>Global Ledger</button>
            </div>

            <div className="card">
                {view === 'auctions' && (
                    <div>
                        <div className="flex-between mb-4">
                            <h3>All Auctions ({auctions.length})</h3>
                            <button onClick={fetchData} className="btn-icon" aria-label="Refresh">↻</button>
                        </div>
                        <div className="history-list">
                            {auctions.map(auc => (
                                <div key={auc.id} className="auction-item flex-between">
                                    <div>
                                        <div className="font-bold">{auc.title}</div>
                                        <div className="text-sub mt-2">
                                            Seller: {auc.seller.username} •
                                            <AuctionTimer createdAt={auc.createdAt} durationMinutes={auc.durationMinutes} status={auc.status} />
                                        </div>
                                    </div>
                                    <span className={getStatusClass(auc.status)}>{auc.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'users' && (
                    <div>
                        <h3 className="mb-4">Registered Users</h3>
                        <div className="table-responsive">
                            <table className="admin-table">
                                <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Joined</th></tr></thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td className="mono-font">#{u.id}</td>
                                            <td>{u.username}</td>
                                            <td><span className={`role-badge ${u.role === 'ADMIN' ? 'role-admin' : ''}`}>{u.role}</span></td>
                                            <td className="text-sub">
                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'bids' && (
                    <div>
                        <div className="flex-between mb-4">
                            <h3>Global Bid Ledger</h3>
                            <button onClick={fetchData} className="btn-icon" aria-label="Refresh">↻</button>
                        </div>
                        <div className="history-list">
                            {allBids.map(b => (
                                <div key={b.id} className="history-item">
                                    <div className="flex-between">
                                        <span><strong>{b.bidder?.username}</strong> on <strong>{b.auction.title}</strong></span>
                                        <span className="text-sub">{new Date(b.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="mt-2 flex-row gap-2 items-center">
                                        <span className="text-sub">Commitment:</span>
                                        <code className="commit-hash">{b.commitment}</code>
                                    </div>
                                    <div className="mt-2">
                                        {b.amount ? <span className="text-green">✔ Revealed: {b.amount} ETH</span> : <span className="text-gold">🔒 Sealed</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
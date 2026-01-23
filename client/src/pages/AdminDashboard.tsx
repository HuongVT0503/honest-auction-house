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
        const pwd = prompt("Enter Admin Password to wipe DB:");
        if (!pwd) return;
        const res = await fetch(`${API_URL}/admin/reset`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
            alert("System Reset");
            fetchData();
        } else {
            alert("Error: " + data.error);
        }
    };

    return (
        <div className="app-container">
            <header className="dashboard-header">
                <h1 className="header-title">Admin Control</h1>
                <div className="header-user">
                    <button onClick={handleReset} className="btn-danger">⚠ Reset System</button>
                    <button onClick={logout}>Logout</button>
                </div>
            </header>

            <div className="admin-nav">
                <button onClick={() => setView('auctions')} className={view === 'auctions' ? 'active' : ''}>Auctions</button>
                <button onClick={() => setView('users')} className={view === 'users' ? 'active' : ''}>Users</button>
                <button onClick={() => setView('bids')} className={view === 'bids' ? 'active' : ''}>All Bids</button>
            </div>

            <div className="card">
                {view === 'auctions' && (
                    <div>
                        <h3>All Auctions</h3>
                        {auctions.map(auc => (
                            <div key={auc.id} className="auction-item text-left">
                                <strong>{auc.title}</strong>
                                <AuctionTimer
                                    createdAt={auc.createdAt}
                                    durationMinutes={auc.durationMinutes}
                                    status={auc.status}
                                    onPhaseChange={fetchData}
                                />
                                <br />
                                <small>Seller: {auc.seller.username} | Status: {auc.status}</small>
                            </div>
                        ))}
                    </div>
                )}

                {view === 'users' && (
                    <div>
                        <h3>Registered Users</h3>
                        <table className="admin-table">
                            <thead><tr><th>ID</th><th>Username</th><th>Role</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>{u.id}</td>
                                        <td>{u.username}</td>
                                        <td>{u.role}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {view === 'bids' && (
                    <div>
                        <h3>Global Bid Ledger (Commitments)</h3>
                        <div className="history-list">
                            {allBids.map(b => (
                                <div key={b.id} className="history-item text-left">
                                    <strong>{b.bidder?.username}</strong> on <em>{b.auction.title}</em>
                                    <br />
                                    Commitment: <code className="commit-hash">{b.commitment.slice(0, 20)}...</code>
                                    <br />
                                    {b.amount ? <span className="text-green">Revealed: {b.amount}</span> : <span className="text-gold">Sealed</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
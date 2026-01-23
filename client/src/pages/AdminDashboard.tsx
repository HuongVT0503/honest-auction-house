import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function AdminDashboard() {
    const { token, logout } = useAuth();
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState(10);

    const createAuction = async () => {
        await fetch(`${API_URL}/auctions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, durationMinutes: duration })
        });
        alert("Auction Created!");
        setTitle('');
    };

    return (
        <div className="app-container">
            <h1>Admin Dashboard</h1>
            <button onClick={logout}>Logout</button>

            <div className="card mt-20">
                <h3>Create New Auction</h3>
                <div className="bid-form">
                    <input placeholder="Auction Title" value={title} onChange={e => setTitle(e.target.value)} />
                    <label>Duration (Minutes): <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
                    <button onClick={createAuction}>Start Auction</button>
                </div>
            </div>
        </div>
    );
}
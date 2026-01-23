import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isReg, setIsReg] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', adminSecret: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isReg ? '/register' : '/login';

    // If Admin Secret is provided during register, assume they want admin
    const body = isReg ?
      { ...formData, isAdmin: !!formData.adminSecret } : formData;

    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (res.ok) {
      login(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } else {
      alert(data.error);
    }
  };

  return (
    <div className="full-height-center">
      <div className="card auth-card">
        <h2 className="text-center mb-4">
          {isReg ? 'Create Account' : 'Honest Auction House'}
        </h2>

        <form onSubmit={handleSubmit} className="bid-form">
          <div>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              placeholder="Enter username"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {isReg && (
            <div>
              <label htmlFor="adminSecret">Admin Secret (Optional)</label>
              <input
                id="adminSecret"
                placeholder="For admin access only"
                value={formData.adminSecret}
                onChange={e => setFormData({ ...formData, adminSecret: e.target.value })}
              />
            </div>
          )}

          <button type="submit" className="primary-btn mt-4">
            {isReg ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-4 text-sub">
          <span>{isReg ? 'Already have an account?' : 'Need an account?'} </span>
          <button onClick={() => setIsReg(!isReg)} className="btn-text">
            {isReg ? 'Log In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
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
    <div className="card">
      <h2>{isReg ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleSubmit} className="bid-form">
        <input placeholder="Username" onChange={e => setFormData({ ...formData, username: e.target.value })} />
        <input type="password" placeholder="Password" onChange={e => setFormData({ ...formData, password: e.target.value })} />
        {isReg && <input placeholder="Admin Secret (Optional)" onChange={e => setFormData({ ...formData, adminSecret: e.target.value })} />}
        <button type="submit">{isReg ? 'Sign Up' : 'Log In'}</button>
      </form>

      <button onClick={() => setIsReg(!isReg)} className="btn-transparent">
        Switch to {isReg ? 'Login' : 'Register'}
      </button>
    </div>
  );
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { type ReactNode } from 'react';
import Login from './pages/Login.tsx';
import UserDashboard from './pages/UserDashboard.tsx';
import AdminDashboard from './pages/AdminDashboard.tsx';

function PrivateRoute({ children, role }: { children: ReactNode, role?: string }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/" />;
  if (role && user.role !== role) return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={<PrivateRoute><UserDashboard /></PrivateRoute>}
          />
          <Route
            path="/admin"
            element={<PrivateRoute role="ADMIN"><AdminDashboard /></PrivateRoute>}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
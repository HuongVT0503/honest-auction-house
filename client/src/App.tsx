import { useState, useEffect } from "react";

function App() {
  const [message, setMessage] = useState("Loading backend status...");

  // Note: We will set this URL in Vercel Environment Variables later
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((res) => res.text())
      .then((data) => setMessage(data))
      .catch(() => setMessage("Error connecting to backend"));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Honest Auction House</h1>
      <p>
        Backend Status: <strong>{message}</strong>
      </p>
    </div>
  );
}

export default App;

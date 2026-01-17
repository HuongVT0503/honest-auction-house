import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Loading backend status...");

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

    fetch(`${API_URL}/`)
      .then((res) => res.text())
      .then((data) => setMessage(data))
      .catch(() => setMessage("Error connecting to backend"));
  }, []);

  return (
    <div className="app-container">
      <h1>Honest Auction House</h1>
      <p>
        Backend Status: <strong>{message}</strong>
      </p>
    </div>
  );
}

export default App;
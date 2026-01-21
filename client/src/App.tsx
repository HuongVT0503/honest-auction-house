import { useState, useEffect, useCallback } from "react";
import { generateBidProof } from "./lib/snark-utils";
import "./App.css";

type Auction = {
  id: number;
  title: string;
  status: "OPEN" | "REVEAL" | "CLOSED";
  seller: { username: string };
  endsAt: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);

  const [amount, setAmount] = useState<number>(0);
  const [secret, setSecret] = useState<string>("");
  const [status, setStatus] = useState("Idle");


  const fetchAuctions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auctions`);
      const data = await res.json();
      setAuctions(data);
    } catch (e) {
      console.error("Failed to fetch auctions", e);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handleLogin = async () => {
    // For prototype: Register if not exists, or Login. 
    // Simplified to just "Register/Get ID" for this demo
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput, password: "password123" }) // Default password
    });
    //register fails (exists)-> login
    let data = await res.json();
    if (data.error) {
      const loginRes = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: "password123" })
      });
      data = await loginRes.json();
      setUser({ id: data.userId, username: usernameInput });
    } else {
      setUser({ id: data.id, username: data.username });
    }
  };

  const handleBid = async () => {
    if (!selectedAuction || !user) return;
    setStatus("Generating Zero Knowledge Proof...");
    try {
      //generate proof in browser
      const { proof, publicSignals } = await generateBidProof(amount, secret);

      setStatus("Proof generated! Sending to server...");

      //send to be
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const res = await fetch(`${API_URL}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auctionId: selectedAuction.id,
          bidderId: user.id,
          proof,
          publicSignals,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus(`Bid Placed! Commitment: ${data.commitment.slice(0, 10)}...`);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auctionId: selectedAuction.id,
          bidderId: user.id,
          amount: amount,
          secret: secret,
        }),
      });
      const data = await res.json();
      if (res.ok) setStatus("Success! Bid Revealed.");
      else setStatus(`Error: ${data.error}`);
    } catch (e) {
      console.error(e);
      setStatus("Reveal failed.");
    }
  };

  return (
    <div className="app-container">
      <h1>Honest Auction House</h1>

      {/* 1. LOGIN SECTION */}
      {!user ? (
        <div className="card">
          <h2>Login / Register</h2>
          <input
            placeholder="Enter Username"
            value={usernameInput}
            onChange={e => setUsernameInput(e.target.value)}
          />
          <button onClick={handleLogin}>Enter System</button>
        </div>
      ) : (
        <div>
          <p>Welcome, <strong>{user.username}</strong> (ID: {user.id})</p>

          {/* 2. AUCTION LIST */}
          {!selectedAuction ? (
            <div className="card">
              <h2>Active Auctions</h2>
              {auctions.map(auc => (
                <div key={auc.id} className="auction-item">
                  <h3>{auc.title}</h3>
                  <p>Status: <strong>{auc.status}</strong></p>

                  {auc.status === "OPEN" && (
                    <p className="auction-timer">
                      Ends at: {new Date(auc.endsAt).toLocaleTimeString()}
                      ({Math.max(0, Math.floor((new Date(auc.endsAt).getTime() - Date.now()) / 60000))} min remaining)
                    </p>
                  )}

                  <button onClick={() => setSelectedAuction(auc)}>
                    {auc.status === "OPEN" ? "Place Bid" : "Reveal Bid"}
                  </button>
                </div>
              ))}
              <button onClick={fetchAuctions}>Refresh List</button>
            </div>
          ) : (
            /* 3. ACTION AREA */
            <div className="card">
              <button onClick={() => setSelectedAuction(null)}>← Back to List</button>
              <h2>{selectedAuction.title} ({selectedAuction.status})</h2>

              <div className="bid-form">
                <input
                  type="number"
                  placeholder="Amount (ETH)"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <input
                  type="text"
                  placeholder="Secret (Keep safe!)"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />

                {selectedAuction.status === "OPEN" ? (
                  <button onClick={handleBid}>Generate Proof & Bid</button>
                ) : (
                  <button onClick={handleReveal} className="btn-reveal">
                    Reveal My Bid
                  </button>
                )}
              </div>
              <p>Status: <strong>{status}</strong></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
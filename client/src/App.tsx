import { useState } from "react";
import { generateBidProof } from "./lib/snark-utils";
import "./App.css";

function App() {
  const [status, setStatus] = useState("Idle");
  const [amount, setAmount] = useState<number>(0);
  const [secret, setSecret] = useState<string>("12345"); //todo In real app, generate random

  // NOTE: For this test, ensure you have created a User and Auction in your DB first!
  // These IDs are hardcoded for testing connection.
  const TEST_AUCTION_ID = 1;
  const TEST_USER_ID = 1;

  const handleBid = async () => {
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
          auctionId: TEST_AUCTION_ID,
          bidderId: TEST_USER_ID,
          proof,
          publicSignals, //contains the commitment Hash(amount, secret)
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
      setStatus("Failed to generate proof or place bid.");
    }
  };

  return (
    <div className="app-container">
      <h1>Honest Auction House</h1>
      <div className="card">
        <h2>Place Sealed Bid</h2>
        <div className="bid-form">
          <input
            type="number"
            placeholder="Bid Amount (ETH)"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <input
            type="text"
            placeholder="Secret (Keep safe!)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button onClick={handleBid}>Generate Proof & Bid</button>
        </div>
        <p>
          Status: <strong>{status}</strong>
        </p>
      </div>
    </div>
  );
}

export default App;
# 🌊 System Flows & Use Cases: Honest Auction House

This document outlines the architectural flows, user journeys, and technical logic of the **Honest Auction House**. It serves as a functional specification for the **Sealed-Bid ZKP Auction System**.

---

## 1. Executive Summary

**Honest Auction House** solves the problem of "Auctioneer Trust" in digital auctions. In standard systems, the database admin can see incoming bids and "front-run" them or leak data.

In this system:

1.  **Bids are encrypted (Hashed)** on the client side.
2.  **Validity is proven** via Zero-Knowledge Proofs (ZKP) without revealing the amount.
3.  **Values are revealed** only after the bidding phase ends.

**Tech Stack:** React (Vite), Node.js (Express), PostgreSQL (Prisma), Circom (ZKP).

---

## 2. Actors & Roles

| Actor             | Role            | Capabilities                                                                     |
| :---------------- | :-------------- | :------------------------------------------------------------------------------- |
| **User (Bidder)** | Participant     | Place sealed bids, download secret backups, reveal bids, view history.           |
| **User (Seller)** | Creator         | Create auctions, view status, extend auctions (if no winner declared).           |
| **Admin**         | System Overseer | View global bid ledger (commitments only), manage users, **reset system state**. |

---

## 3. Core Workflows

### A. Authentication & Session Management

The system uses **JWT (JSON Web Tokens)** for stateless authentication.

- **Register:** User creates account. Password is hashed via `bcrypt`.
- **Login:** Server issues a JWT valid for 24 hours.
- **Persistence:** Token and User Object are stored in `localStorage`.

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant Server
    participant DB

    User->>Client: Enter Credentials
    Client->>Server: POST /login
    Server->>DB: Find User & Compare Hash
    alt Valid
        Server-->>Client: Return JWT Token
        Client->>Client: Save to localStorage
    else Invalid
        Server-->>Client: 401 Unauthorized
    end
```

### B. The Auction Lifecycle (Seller Flow) (Hybrid State Engine)

The system uses a **Lazy + Proactive**, but **Lazy-First** state update mechanism to ensure phase transitions are accurate to the millisecond when a user interacts with the system.

1. **Lazy Updates (Primary):** Whenever any user fetches the auction list (`GET /auctions`), the server calculates if the phase should shift. This ensures transitions happen exactly when a user is looking at the data.
2. **Client Polling:** The React frontend polls `GET /auctions` every 5 seconds, triggering these lazy updates frequently.
3. **Background Worker:** A `setInterval` runs every 60 seconds on the server to catch auctions that might otherwise sit idle.

**Time Distribution:**

- **Total Duration:** Configured by Seller (default 10 mins).
- **Bidding Phase (OPEN):** Bidding is active (90% of duration).
- **Reveal Phase (REVEAL):** Secrets must be submitted (Remaining 10% of duration).
- **CLOSED:** Winner is calculated based on highest revealed amount.

**Emergency Extension Logic**
If a user interacts with an auction that _should_ have ended but is still "OPEN" (due to server lag or idle time), the system triggers an **Emergency Extension**:

- Calculates time since creation.
- Forces status to `REVEAL`.
- Adds **10 minutes** to the current time to allow for disclosure.

```mermaid
stateDiagram-v2
    [*] --> OPEN: Seller Creates Auction

    state "OPEN (Bidding)" as OPEN {
        [*] --> AcceptingProofs
        AcceptingProofs --> AcceptingProofs: Users submit ZK Proofs
    }

    OPEN --> REVEAL: Time > 90% (Lazy Trigger)

    state "REVEAL (Verification)" as REVEAL {
        [*] --> WaitingForSecrets
        WaitingForSecrets --> Validated: User submits Secret
        Validated --> DB_Update: Amount Revealed
    }

    REVEAL --> CLOSED: Time > 100% (Lazy Trigger)

    state "CLOSED" as CLOSED {
        [*] --> CalculateWinner
        CalculateWinner --> [*]: Highest Bidder Declared
    }

    CLOSED --> REVEAL: Seller Extends Auction (If no winner)
```

#### Emergency Extension Feature

To protect users from server downtime or missed windows, if the system detects an auction has passed its "End Time" while still in the "OPEN" phase, it triggers an **Emergency Extension**. This automatically adds 10 minutes to the clock and forces the auction into the **REVEAL** phase, ensuring bidders have a fair chance to disclose their amounts.

### C. The Bidder Flow (Privacy Core)

This is the most critical flow. It is split into two phases to ensure the server never knows the bid amount while the auction is open.

#### Phase 1: The Sealed Bid (Commitment)

**Goal:** Prove valid bid structure without revealing the amount.

1.  **Inputs:** User inputs `Amount` (e.g., 5 ETH) and `Secret` (e.g., 12345).
2.  **Hashing:** Client calculates `Commitment = Poseidon(Amount, Secret, AuctionID)`.
3.  **ZKP Generation:** Client generates a proof that says "I know two numbers that hash to C, and the Amount is > 0".
4.  **Verification:** Server checks the proof and the `AuctionID` (to prevent Replay Attacks).
5.  **Persistence:** Server saves the `Commitment`. **Amount remains NULL**.

#### Phase 2: The Reveal

**Goal:** Open the envelope.

1.  **Trigger:** User triggers with the Reveal button. Phase changes to `REVEAL`.
2.  **Restoration:** User loads `Secret` from `localStorage` or backup `.txt` file (or type it down from memory).
3.  **Submission:** Client sends plain text `{ Amount, Secret }`.
4.  **Validation:** Server calculates `NewHash = Poseidon(Amount, Secret, AuctionID)`.
5.  **Comparison:** If `NewHash == Stored_Commitment`, the bid is valid. The DB is updated with the real amount.

⚠️ **Protocol Risk**: If a user refuses to perform Phase 2 (Rational Irrationality), the bid is lost. Incentives (Collateral) are required to fix this in the future.

```mermaid
sequenceDiagram
    box "Private Side (Client)" #f9f9f9
        participant U as User
        participant C as Browser
    end
    box "Public Side (Server)" #eaeaea
        participant S as API
        participant D as Database
    end

    Note over U, D: PHASE 1: SEALED BIDDING
    U->>C: Input: 10 ETH, Secret: 999
    C->>C: Calc Hash(10, 999) -> "0xABC"
    C->>C: Gen ZK Proof (Witness: 10, 999)
    C->>U: Download "bid-backup.txt"
    C->>S: POST /bid {proof, public: "0xABC"}
    S->>S: Verify Proof & AuctionID
    S->>D: INSERT Bid (Commitment="0xABC", Amount=NULL)

    Note over U, D: PHASE 2: REVEAL
    U->>C: Click "Reveal" (Load Secret 999)
    C->>S: POST /reveal {amount: 10, secret: 999}
    S->>D: GET Commitment ("0xABC")
    S->>S: Calc Hash(10, 999)
    alt Hash Matches
        S->>D: UPDATE Bid SET Amount=10
        S-->>C: Success
    else Mismatch
        S-->>C: CHEATER DETECTED
    end
```

## 4. Technical Analysis & Security Disclaimers

### Security Features

1.  **Replay Attack Protection:**
    - The ZK Circuit includes `auctionId` as a public input.
    - The hash calculation is `Hash(Amount, Secret, AuctionA)`, which is mathematically distinct from `Hash(Amount, Secret, AuctionB)`.
    - The server explicitly verifies that the `proofAuctionId` matches the target auction before accepting the bid.
2.  **Negative Bid Prevention:**
    - The circuit uses `Num2Bits(64)` to strictly enforce that the `amount` fits within a 64-bit positive integer range.
    - This prevents "Finite Field Wrap-around" attacks where a negative number (e.g., -1) could be interpreted by the circuit as a massive positive number.
3.  **Data Minimization:**
    - The database schema defines `amount` and `secret` as nullable (`Int?` and `String?`).
    - These fields remain strictly empty (`NULL`) until the user voluntarily authorizes the reveal phase.

### Known Limitations & Critical Trade-offs

#### 1. The "Rational Irrationality" of Revealing

- **The Problem:** In a sealed-bid auction, a bidder who realizes they have bid too low (or simply changes their mind) has **no economic incentive** to perform the "Reveal" step. If the highest bidder fails to reveal, the auction might close with no winner or an incorrect price.
- **The Solution:** Implement **Bid Collateral**. Users must deposit funds (held in escrow/smart contract) to place a bid. If they submit a commitment but fail to reveal during the specific Reveal Phase, their deposit is **slashed** (confiscated). This aligns economic incentives with protocol compliance.

#### 2. Client-Side Secret Management (XSS Risk)

- **The Problem:** This application stores the "Secret" (random number) in the browser's `localStorage` to allow for a one-click reveal experience. In a production environment, `localStorage` is vulnerable to **Cross-Site Scripting (XSS)** attacks. If malicious JS is injected into the page, it could steal the user's secrets (though it cannot change the commitment already on the server).
- **The Solution:** Secrets should be managed via a browser extension (like MetaMask) or encrypted using a key derived from the user's password, ensuring they are never stored in plaintext in the DOM storage.

#### 3. Trusted Setup Centralization

- **The Problem:** The proving keys (`.zkey`) and verification keys were generated locally by the developer. This creates a "Centralization Risk" where the developer _could_ theoretically retain the toxic waste (entropy) and forge fake proofs.
- **The Solution:** A **Multi-Party Computation (MPC) Ceremony** (Trusted Setup) is required. This distributes the entropy generation across many participants. As long as at least one participant deletes their toxic waste, the system is mathematically secure.

#### 4. Client-Side Compute (Thick Client)

- Generating ZK proofs in the browser using WASM is CPU intensive. While `snarkjs` is efficient, it may still be slow on older mobile devices.

---

## 5. Suggestions for Improvement

| Feature            | Description                                        | Impact                                                                                          |
| :----------------- | :------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **WebSockets**     | Replace `setInterval` polling with `Socket.io`.    | Provides real-time updates and a "Live Auction" feel without aggressive polling.                |
| **Bid Collateral** | Require a deposit to place a bid.                  | Punishes users who refuse to reveal by "slashing" their deposit, solving the incentive problem. |
| **MPC Setup**      | Use Multi-Party Computation for the Trusted Setup. | Provides higher trust guarantees for the ZKP keys compared to a single-user setup.              |

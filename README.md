# Honest Auction House (ZKP Verifiable Sealed-Bid)

A Zero-Knowledge Proof (ZKP) based auction system where users can submit sealed bids without revealing the amount to the server or public until the auction closes. This project guarantees bid privacy and auction integrity using `circom` and `snarkjs`.

---

## 🛠 Tech Stack

- [cite_start]**Frontend:** React (Vite) + TypeScript [cite: 23, 24]
- [cite_start]**Backend:** Node.js + Express [cite: 54]
- [cite_start]**Database:** PostgreSQL (via Prisma ORM) [cite: 55, 56]
- [cite_start]**ZKP Engine:** Circom (Circuits) + SnarkJS (Proofs) [cite: 8, 9]
- **Infrastructure:** Render (Backend/DB) + Vercel (Frontend)

---

## 📂 Project Structure

```text
honest-auction-house/
├── circuits/               # ZKP Circuits (.circom) & Compilation Artifacts
├── client/                 # React Frontend (Vite)
├── server/                 # Express Backend & Prisma ORM
├── docker-compose.yml      # (Optional) Local DB setup
└── README.md               # Project Documentation
```

---

## 📅 Project Progress Log

### ✅ Phase 1: Infrastructure & Setup (Completed)

- **Monorepo Initialization:** Established directory structure for `client`, `server`, and `circuits`.
- **Dependencies Installed:** Configured `package.json` for root, client (React/Vite), and server (Express/Prisma).
- **Git Integration:** Set up `.gitignore` to handle node_modules, build artifacts, and sensitive `.env` files.
- **Deployment:**
  - Frontend successfully deployed to **Vercel**.
  - Backend successfully deployed to **Render**.
- PostgreSQL database instance provisioned and connected on **Render**.

### ✅ Phase 2: Database & Backend Core (Completed)

- **Schema Design:** Defined Prisma models for `User`, `Auction`, and `Bid`.
- **Database Sync:** Ran `prisma db push` and `prisma generate` to create the SQL tables.
- **API Implementation:**
  - Initialized Express server with CORS and JSON parsing.
  - Implemented `POST /register`, `POST /login`, and `POST /auctions`.
- **Connected:** `PrismaClient` to the active PostgreSQL database.

### ✅ Phase 3: ZKP Circuit Engine & Verification (Completed)

- **Circuit Logic:**
  - Created `circuits/bid_check.circom`: Validates `Hash(amount, secret) == commitment`.
  - Created `circuits/simple_hash.circom`: Utility for generating hashes.
- **Trusted Setup (Ceremony):**
  - Generated Powers of Tau (Phase 1) and ZKey artifacts (Phase 2).
  - Exported `verification_key.json` for server-side checks.
- **Client Integration:**
  - Implemented `snark-utils.ts` using `snarkjs` and `circomlibjs`.
  - **Polyfilled Node.js globals** (Buffer) to allow ZK proof generation in Vite/Browser.
- **Server Verification:**
  - Implemented `utils/verifier.ts` to cryptographically verify proofs on the backend.
  - Added `POST /bid` endpoint that accepts a proof, verifies it, and stores the commitment.

### ✅ Phase 4: Full Auction Lifecycle (Completed)

- **Reveal Phase:** Implemented `POST /bid/reveal` logic to cryptographically verify `Hash(amount, secret) == stored_commitment`.
- **Frontend Integration:**
  - **Dynamic Auth:** Replaced hardcoded IDs with a working Login/Register flow.
  - **Auction Dashboard:** Real-time fetching of active auctions via `GET /auctions`.
  - **Action States:** UI automatically toggles between "Place Sealed Bid" and "Reveal Bid" based on auction status.
- **Deployment & Stability:**
  - Resolved TypeScript definitions and ESM import issues for `circomlibjs` on Node.js.
  - Fixed React Hook dependency cycles and linting errors for production builds.
  - Configured automated database schema syncing (`prisma db push`) for Render.

### ✅ Phase 5: Production Hardening & UX Polish (Completed)

- **Security:** - Replaced plaintext password storage with `bcrypt` hashing for `POST /register` and `POST /login`.
- **UX Automation:** - Implemented `setInterval` polling in React to automatically refresh the auction list.
  - Added logic to auto-trigger the "Lazy Update" on the server, ensuring auctions transition from `OPEN` to `REVEAL` without manual refresh.
- **Production Config:** - Configured strict CORS settings to allow secure communication between Vercel (Frontend) and Render (Backend).

---

---

## 🚀 How to Run Locally

### 1. Backend (Server)

```bash
cd server
# Ensure .env contains your DATABASE_URL
npm install
npm run dev
# Server runs on http://localhost:3000
```

### 2. Frontend (Client)

```bash
cd client
npm install
npm run dev
# App runs on http://localhost:5173
```

### 3. ZKP Circuits (Regeneration)

If you modify `.circom` files, you must recompile. Note: We are using the Windows binary for `circom`.

```bash
cd circuits

# 1. Compile Circuit (Generates WASM)
circom bid_check.circom --r1cs --wasm --sym

# 2. Generate Reference ZKey (Phase 2)
snarkjs groth16 setup bid_check.r1cs pot12_final.ptau bid_check_0000.zkey

# 3. Contribute Randomness
snarkjs zkey contribute bid_check_0000.zkey bid_check_final.zkey --name="YourName" -v

# 4. Export Verification Key
snarkjs zkey export verificationkey bid_check_final.zkey verification_key.json
```

---

## 🔜 Next Steps

1.  **Artifact Migration:** Move `bid_check.wasm` and `bid_check_final.zkey` to `client/public/`.
2.  **Client Logic:** Implement `snark-utils.ts` in React to generate proofs in the browser using `snarkjs`.
3.  **Verification:** Add `POST /bid` endpoint to Server that verifies the ZK proof before saving the commitment to the DB.

.circom files ( require local recompilation).

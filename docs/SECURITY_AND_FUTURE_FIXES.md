🛡️ Security Report

This document outlines the security posture of the application, highlighting critical vulnerabilities, architectural risks, and verified security protections.

---

## 1. ✅ Security Claims

### A. Replay Attack Protection

- **How:**
  - The circuit `bid_check.circom` takes `auctionId` as an input.
  - The Poseidon hash includes `auctionId`: `Hash(amount, secret, auctionId)`.
  - The server (`index.ts`) explicitly checks: `if (BigInt(proofAuctionId) !== BigInt(auctionId)) throw Error`.
- **Result:** A proof generated for Auction #1 cannot be replayed to win Auction #2.

### B. Negative Bid Prevention (Integer Overflow)

- **How:**
  - The `bid_check.circom` circuit uses `component rangeCheck = Num2Bits(64)`.
  - In the BN128 scalar field, `-1` wraps to a 254-bit integer.
  - The 64-bit range check correctly fails for these wrapped values.
- **Result:** Attackers cannot submit negative bids to trick the system.

### C. Password Security

Passwords are hashed using `bcryptjs` with **10 rounds**.

---

## 2. 🚨 Existing Vulnerabilities (Require Fixing in Future Updates)

### A. Client-Side Secret Storage (XSS Risk)

- **Severity:** **Critical** (OWASP A05: Security Misconfiguration)
- **The Flaw:** The application stores the `secret` (the key to the bid) and the `JWT` in the browser's `localStorage` (`UserDashboard.tsx` and `AuthContext.tsx`).
- **The Risk:** `localStorage` is accessible by any JavaScript code on the domain. If an attacker finds a Cross-Site Scripting (XSS) vulnerability (e.g., via a compromised dependency), they can exfiltrate all user secrets and JWTs.
- **Fix:**
  1.  **Auth:** Move JWTs to `HttpOnly` Cookies (inaccessible to JS) will solve the XSS exfiltration risk. That change will require implementing **CSRF Protection** (e.g., SameSite=Strict).
  2.  **Secrets:** Do not persist secrets in `localStorage`. Require users to re-upload their `bid-backup.txt` to reveal, or use in-memory state (`sessionStorage`) that clears on tab close.

### B. Missing Rate Limiting (DoS Risk)

- **Severity:** **High**
- **The Flaw:** The `POST /bid` endpoint triggers `verifyBidProof` on the server.
- **The Risk:** ZK verification involves pairing checks, which are CPU-intensive. An attacker can flood the server with random (invalid) proofs, exhausting CPU resources and causing a Denial of Service (DoS) for legitimate users.
- **Fix:** Apply `express-rate-limit` on all endpoints, with stricter limits on `/bid` and `/register`.

### C. The "Rational Irrationality" Problem (Griefing)

- **Severity:** **High**
- **The Issue:** In this commit-reveal scheme, a user who realizes they bid too low has **no economic incentive** to reveal their bid.
- **The Attack:** A malicious user places a massive bid (e.g., 1000 ETH) to discourage others but refuses to reveal it. The auction closes with no winner, or the item sells for a lower price than the true market value.
- **Fix:** Implement **Bid Collateral**. Users must deposit funds to bid; if they fail to reveal during the specific phase, their deposit is slashed (forfeited).

---

## 4. Code Quality & Best Practices

1.  **Atomic Transactions:** Ensure database updates (especially closing auctions) use `prisma.$transaction` to prevent partial state updates during server crashes.
2.  **Security Headers:** Install `helmet` middleware in Express to set secure HTTP headers (HSTS, X-Frame-Options).
3.  **Input Sanitization:** While `BigInt` checks are in place, use a library like `Zod` to strictly validate all API inputs before processing.

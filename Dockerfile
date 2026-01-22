# ==========================================
# Build Frontend
# ==========================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/client

# Copy dependency definitions
COPY client/package*.json ./
RUN npm ci

# Copy source and build
COPY client/ .
# Note: Ensure your .wasm and .zkey files are in client/public or moved there before build
RUN npm run build

# ==========================================
# Build Backend
# ==========================================
FROM node:20-slim AS backend-builder
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate
RUN npm run build

# ==========================================
# Production Runner
# ==========================================
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y openssl ca-certificates

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies for the backend
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy artifacts
COPY --from=backend-builder /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/server/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=backend-builder /app/server/dist ./dist
COPY --from=backend-builder /app/server/prisma ./prisma
# Copy the built frontend into the backend's public folder
COPY --from=frontend-builder /app/client/dist ./dist/public
# Copy verification key for ZK proofs
COPY --from=backend-builder /app/server/src/verification_key.json ./dist/verification_key.json

USER node
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies including Chrome
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY tsconfig.json .
COPY vite.config.ts .
COPY postcss.config.js .
COPY tailwind.config.ts .
COPY components.json .
COPY server ./server
COPY client ./client
COPY shared ./shared

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Install Chrome and dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install TSX globally
RUN npm install -g tsx

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/vite.config.ts ./

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

CMD ["tsx", "server/index.ts"]
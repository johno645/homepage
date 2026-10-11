# Stage 1: Dependencies
FROM node:24-bookworm-slim AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED 1


# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Keep the runtime asset copy valid when there are no public assets.
RUN mkdir -p /app/public

# Build the application
RUN npm run build

# Stage 3: Runner
FROM gcr.io/distroless/nodejs24-debian12 AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files
COPY --from=builder --chown=nonroot:nonroot /app/public ./public
COPY --from=builder --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/.next/static ./.next/static

USER nonroot

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["server.js"]


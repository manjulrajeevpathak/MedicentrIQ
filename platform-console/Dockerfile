# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# platform-console reads CORE_API_URL server-side at runtime (not a build-time
# NEXT_PUBLIC_* var), so nothing about core-api needs baking in here.
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

# ---- runtime stage: Next.js standalone server ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3202
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 3202
CMD ["node", "server.js"]

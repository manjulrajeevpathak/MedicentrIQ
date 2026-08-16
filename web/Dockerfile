# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* are inlined at build time. All four segments call core-api
# server-side over the compose network, so default to the internal service URL.
ARG NEXT_PUBLIC_CORE_API_URL=http://core-api:4100
ENV NEXT_PUBLIC_CORE_API_URL=$NEXT_PUBLIC_CORE_API_URL
# Internal core-api URL the /care same-origin proxy rewrite forwards to (baked at build).
ARG CORE_API_INTERNAL_URL=http://core-api:4100
ENV CORE_API_INTERNAL_URL=$CORE_API_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

# ---- runtime stage: Next.js standalone server (serves /staff /console /clinician /care) ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

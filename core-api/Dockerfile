# syntax=docker/dockerfile:1

# ---- build stage: compile TypeScript -> dist ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
  # tsc does not copy non-TS assets; ship the bundled ICD-10 gz next to its module.
  && if [ -d src/domain/data ]; then mkdir -p dist/domain && cp -r src/domain/data dist/domain/data; fi

# ---- runtime stage: production dependencies only ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Local-disk upload fallback writes here when S3 is not configured (mount a volume).
RUN mkdir -p /app/.uploads && chown -R node:node /app/.uploads
USER node
EXPOSE 4100
CMD ["node", "dist/main.js"]

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- web: the Next.js server ----
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S pocket && adduser -S pocket -G pocket && mkdir -p /data/uploads && chown -R pocket:pocket /data
COPY --from=build /app/public ./public
COPY --from=build --chown=pocket:pocket /app/.next/standalone ./
COPY --from=build --chown=pocket:pocket /app/.next/static ./.next/static
USER pocket
EXPOSE 3000
CMD ["node", "server.js"]

# ---- worker: recurring transactions, reminders ----
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY worker ./worker
USER node
CMD ["node", "--conditions=react-server", "--import", "tsx", "worker/index.ts"]

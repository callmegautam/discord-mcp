FROM oven/bun:1.4.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.3-alpine
WORKDIR /app
ENV NODE_ENV=production
# Only used with TRANSPORT=http. Inside the container 127.0.0.1 can't be reached from the host, so
# listen on every interface and limit exposure where the port is published.
ENV HTTP_HOST=0.0.0.0
EXPOSE 3000
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
USER bun
ENTRYPOINT ["bun", "run", "src/index.ts"]

# SSD Backend — Node 22, pnpm, Express
# Builds a production image that runs `node src/server.js` on the PORT
# environment variable (set in the ECS task definition, e.g. 4000).

FROM node:22-alpine

WORKDIR /app

# Match the pnpm version pinned in package.json ("packageManager").
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

# Install dependencies first, in their own layer, so `docker build` only
# re-runs this (slow) step when package.json/pnpm-lock.yaml actually change.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Now bring in the actual application code.
COPY . .

# Documents the port the app listens on (src/server.js reads env.PORT).
EXPOSE 4000

# Health check path used by the target group: /api/v1/health
CMD ["node", "src/server.js"]

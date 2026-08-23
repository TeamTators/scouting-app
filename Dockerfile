FROM node:24.13.1-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache git
RUN npm install -g typescript@latest

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# --- FORCE PNPM TO ALLOW BUILDING THE GIT DEPENDENCY ---
RUN pnpm config set --global allowBuilds true
# Alternatively, if you want to target just that package:
# RUN pnpm config set --global onlyBuiltDependencies '["ts-utils"]'

COPY . .
COPY ./.env.example .env

# Use standard install without frozen lockfile to avoid overrides mismatch
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter ts-utils build

# RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
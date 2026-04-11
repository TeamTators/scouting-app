FROM node:24.13.1-alpine

# Install pnpm globally
RUN npm install -g pnpm@10.30.0
RUN npm install -g typescript@5.9.3

WORKDIR /app

# Copy only package files first for caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install


COPY ./build ./build
COPY ./.svelte-kit ./.svelte-kit
COPY ./cli ./cli
COPY ./config ./config
COPY ./drizzle ./drizzle
COPY ./mjml ./mjml
COPY ./private ./private
COPY ./scripts ./scripts
COPY ./src ./src
COPY ./static ./static
COPY ./config.docker.json ./config.json

RUN touch .env

EXPOSE 3000
CMD ["pnpm", "start"]
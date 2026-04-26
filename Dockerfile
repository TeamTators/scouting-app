# syntax=docker/dockerfile:1.7
FROM node:24.13.1-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Use the pinned pnpm version from the repo for stable cache keys.
RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

# Copy only package files first for caching
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm install --frozen-lockfile --prefer-offline


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
COPY ./config.example.json ./config.example.json

RUN touch .env

EXPOSE 3000
CMD ["pnpm", "start"]
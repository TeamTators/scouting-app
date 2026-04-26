## config

Configuration assets used by local dev, containers, and production deployments.

### Files

- .env.example: sample environment variables (copy to .env).
- .env: local environment variable overrides (not committed).
- config.schema.json: JSON schema for config validation.
- nginx.conf: reverse proxy template for container deployments.
- nvm.sh: Node version helper for shell-based setups.
- postgres.sh: Postgres bootstrap script for containers.
- redis.sh: Redis bootstrap script for containers.
- start.sh: container entrypoint and startup helper.

### Setup

1. Copy the example config:
   - .env.example to .env
2. Adjust values for your environment (ports, database, redis, etc.).
3. If you want validation, use config.schema.json in your editor or tooling.

### Notes

- .env is environment-specific. Avoid committing secrets.
- Docker files and scripts read from .env and environment variables.

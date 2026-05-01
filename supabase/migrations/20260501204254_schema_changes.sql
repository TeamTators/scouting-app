-- Grant usage to the core roles
GRANT USAGE ON SCHEMA test TO anon, authenticated, service_role, authenticator;

-- Grant usage to the postgres user (if not already owner)
GRANT USAGE ON SCHEMA test TO postgres;

-- Ensure service_role specifically has access to everything within
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA test TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA test TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA test TO service_role;


-- Grant usage to the core roles
GRANT USAGE ON SCHEMA core TO anon, authenticated, service_role, authenticator;

-- Grant usage to the postgres user (if not already owner)
GRANT USAGE ON SCHEMA core TO postgres;

-- Ensure service_role specifically has access to everything within
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA core TO service_role;
-- Create Read-Only User for Search Service
-- This script creates a read-only PostgreSQL user for the search service
-- Run this script with a database admin user

-- Create the read-only user
CREATE USER search_readonly WITH PASSWORD 'secure_readonly_password';

-- Grant connection privileges to all country databases
GRANT CONNECT ON DATABASE landomo_australia TO search_readonly;
GRANT CONNECT ON DATABASE landomo_uk TO search_readonly;
GRANT CONNECT ON DATABASE landomo_usa TO search_readonly;
GRANT CONNECT ON DATABASE landomo_czech TO search_readonly;
GRANT CONNECT ON DATABASE landomo_france TO search_readonly;
GRANT CONNECT ON DATABASE landomo_spain TO search_readonly;
GRANT CONNECT ON DATABASE landomo_italy TO search_readonly;
GRANT CONNECT ON DATABASE landomo_slovakia TO search_readonly;
GRANT CONNECT ON DATABASE landomo_germany TO search_readonly;
GRANT CONNECT ON DATABASE landomo_hungary TO search_readonly;
GRANT CONNECT ON DATABASE landomo_austria TO search_readonly;

-- Grant schema usage (run these commands after connecting to each database)

-- For landomo_australia
\c landomo_australia
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_uk
\c landomo_uk
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_usa
\c landomo_usa
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_czech
\c landomo_czech
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_france
\c landomo_france
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_spain
\c landomo_spain
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_italy
\c landomo_italy
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_slovakia
\c landomo_slovakia
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_germany
\c landomo_germany
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_hungary
\c landomo_hungary
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- For landomo_austria
\c landomo_austria
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO search_readonly;

-- Verify permissions
\c landomo_australia
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'search_readonly'
  AND table_schema = 'public'
  AND table_name = 'properties';

-- Expected output: search_readonly | SELECT

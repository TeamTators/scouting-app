--
-- PostgreSQL database cluster dump
--

\restrict JSQkRPyVYHUaCLz4bNGdrjYI7dAZHVUCQA8tjCCpnB9y8v1gR5oHT0fGVxCkCZV

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticator;
ALTER ROLE authenticator WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:Kk9ozCLpSNnmvoiup9XUGw==$wDrwojUY80Rud7fuqkqaOzi0hKfkBEaroAoIXv+dOHA=:Eabgq5ttISIooH6bao2cJTKZ40RkRger/0BAIVOGRQU=';
CREATE ROLE dashboard_user;
ALTER ROLE dashboard_user WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB NOLOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE pgbouncer;
ALTER ROLE pgbouncer WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:kKQSx99KzmvFYmsYHBiMNQ==$8ZfTx3Cg/0G2Xs+qa6kcJ6fr7LigBrq561W4JtZtacM=:lWUjAjO/6Slk1DEzdgJYo5ufYxmAbGt1G1X1l9qR+mM=';
CREATE ROLE postgres;
ALTER ROLE postgres WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:ojWfJti53ngEWDEsA5kAIg==$WErk6HuMRcJMEgyLlXxVwheWO8xpzA/IpO+gVAwrgc4=:a4PNCTGRvZ545yu6lvK/c+gTq/B0VohxLIXpdwk5lPY=';
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_admin;
ALTER ROLE supabase_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:L81q4HQBbv7kuSecbFe1AQ==$n9ZYMz/Yv8qWoGnv70UMq5VbSrIxNUrN16nZdBhzeCY=:70fYlmAV+6FV3mC3XJjDAnFsyU6lNu1x75NAlVbuYf4=';
CREATE ROLE supabase_auth_admin;
ALTER ROLE supabase_auth_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:Xbw2vjZ6L0k0BzT8UgzWEg==$CEM2WHlXWI9s8N+C+N85Eb2LYyZiLFFScCNHj7S/tVc=:SYjIoA/7DCe4xCVqrdvMTUkSjotyI3JtzPBZTM2YWsA=';
CREATE ROLE supabase_functions_admin;
ALTER ROLE supabase_functions_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:dZ9bV+XoANG53XHvxbMDdQ==$a7KYu1VdWsd1NKHqI1ke9PtG8znDvhizxMXyqm9iPIg=:toSPyQIt9ugIL5WPJMnmgNRsgkwUcEFrqSaUrwWcncI=';
CREATE ROLE supabase_read_only_user;
ALTER ROLE supabase_read_only_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_realtime_admin;
ALTER ROLE supabase_realtime_admin WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_replication_admin;
ALTER ROLE supabase_replication_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE supabase_storage_admin;
ALTER ROLE supabase_storage_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:xAN9AME9yO5XKWpYGwsA6w==$QXYNPUrZ/aLe+guUwFDuospoNIDBKtfDMKKCtVeZSGw=:qgodZ03o7vkqjgeYur5wpMAh/AMvEYcKygV8veiRpt4=';
CREATE ROLE sveltekit_template;
ALTER ROLE sveltekit_template WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:lzyLTtEDmvq/YTeu41lykA==$bABkvAEkDYVyWH09r5D3Xt2iWp3VqbYtgOklVRHb65E=:3Vs5xIafLmGtkxsdP2N9HL7/G6MiMv/RTKmakqeuJwg=';

--
-- User Configurations
--

--
-- User Config "anon"
--

ALTER ROLE anon SET statement_timeout TO '3s';

--
-- User Config "authenticated"
--

ALTER ROLE authenticated SET statement_timeout TO '8s';

--
-- User Config "authenticator"
--

ALTER ROLE authenticator SET session_preload_libraries TO 'safeupdate';
ALTER ROLE authenticator SET statement_timeout TO '8s';
ALTER ROLE authenticator SET lock_timeout TO '8s';

--
-- User Config "postgres"
--

ALTER ROLE postgres SET search_path TO E'\\$user', 'public', 'extensions';

--
-- User Config "supabase_admin"
--

ALTER ROLE supabase_admin SET search_path TO E'\\$user', 'public', 'auth', 'extensions';
ALTER ROLE supabase_admin SET log_statement TO 'none';

--
-- User Config "supabase_auth_admin"
--

ALTER ROLE supabase_auth_admin SET search_path TO 'auth';
ALTER ROLE supabase_auth_admin SET idle_in_transaction_session_timeout TO '60000';
ALTER ROLE supabase_auth_admin SET log_statement TO 'none';

--
-- User Config "supabase_functions_admin"
--

ALTER ROLE supabase_functions_admin SET search_path TO 'supabase_functions';

--
-- User Config "supabase_storage_admin"
--

ALTER ROLE supabase_storage_admin SET search_path TO 'storage';
ALTER ROLE supabase_storage_admin SET log_statement TO 'none';


--
-- Role memberships
--

GRANT anon TO authenticator;
GRANT anon TO postgres;
GRANT authenticated TO authenticator;
GRANT authenticated TO postgres;
GRANT authenticator TO supabase_storage_admin;
GRANT pg_monitor TO postgres;
GRANT pg_read_all_data TO postgres;
GRANT pg_read_all_data TO supabase_read_only_user;
GRANT pg_signal_backend TO postgres;
GRANT service_role TO authenticator;
GRANT service_role TO postgres;
GRANT supabase_functions_admin TO postgres;
GRANT supabase_realtime_admin TO postgres;




\unrestrict JSQkRPyVYHUaCLz4bNGdrjYI7dAZHVUCQA8tjCCpnB9y8v1gR5oHT0fGVxCkCZV

--
-- PostgreSQL database cluster dump complete
--


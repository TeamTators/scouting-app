--
-- PostgreSQL database dump
--

\restrict ESDARySEbNiltJxx69hlNCa6Ms5aTMaFJqUYe8bGuTKqw9pb8TWgIFwHwScH70V

-- Dumped from database version 15.8
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: test_schema; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA test_schema;


ALTER SCHEMA test_schema OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_notification; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.account_notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    severity text NOT NULL,
    icon text NOT NULL,
    icon_type text NOT NULL,
    link text,
    read boolean DEFAULT false NOT NULL,
    archived boolean NOT NULL,
    account_id uuid
);


ALTER TABLE test_schema.account_notification OWNER TO postgres;

--
-- Name: admin; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL
);


ALTER TABLE test_schema.admin OWNER TO postgres;

--
-- Name: profile; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.profile (
    id uuid DEFAULT auth.uid() NOT NULL,
    username text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email character varying DEFAULT ''::character varying NOT NULL
);


ALTER TABLE test_schema.profile OWNER TO postgres;

--
-- Name: role; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    name text NOT NULL,
    description text,
    parent uuid DEFAULT gen_random_uuid(),
    color text
);


ALTER TABLE test_schema.role OWNER TO postgres;

--
-- Name: role_account; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.role_account (
    account_id uuid NOT NULL,
    role_id bigint NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archived boolean DEFAULT false
);


ALTER TABLE test_schema.role_account OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account_id uuid,
    prev_url text,
    archived boolean DEFAULT false NOT NULL
);


ALTER TABLE test_schema.session OWNER TO postgres;

--
-- Name: test; Type: TABLE; Schema: test_schema; Owner: postgres
--

CREATE TABLE test_schema.test (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false,
    name text NOT NULL,
    age integer NOT NULL
);


ALTER TABLE test_schema.test OWNER TO postgres;

--
-- Name: account_notification account_notification_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.account_notification
    ADD CONSTRAINT account_notification_pkey PRIMARY KEY (id);


--
-- Name: admin admins_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.admin
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);


--
-- Name: profile profiles_username_key; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.profile
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: role_account role_account_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.role_account
    ADD CONSTRAINT role_account_pkey PRIMARY KEY (id);


--
-- Name: role roles_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.role
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: test test_pkey; Type: CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.test
    ADD CONSTRAINT test_pkey PRIMARY KEY (id);


--
-- Name: account_notification account_notification_account_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.account_notification
    ADD CONSTRAINT account_notification_account_id_fkey FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin admin_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.admin
    ADD CONSTRAINT admin_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profile profile_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.profile
    ADD CONSTRAINT profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_account role_account_account_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.role_account
    ADD CONSTRAINT role_account_account_id_fkey FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role roles_parent_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.role
    ADD CONSTRAINT roles_parent_fkey FOREIGN KEY (parent) REFERENCES test_schema.role(id) ON DELETE CASCADE;


--
-- Name: session session_account_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.session
    ADD CONSTRAINT session_account_id_fkey FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session session_id_fkey; Type: FK CONSTRAINT; Schema: test_schema; Owner: postgres
--

ALTER TABLE ONLY test_schema.session
    ADD CONSTRAINT session_id_fkey FOREIGN KEY (id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: test Allow update; Type: POLICY; Schema: test_schema; Owner: postgres
--

CREATE POLICY "Allow update" ON test_schema.test FOR UPDATE TO test_schema USING (true);


--
-- Name: test Enable delete for all users; Type: POLICY; Schema: test_schema; Owner: postgres
--

CREATE POLICY "Enable delete for all users" ON test_schema.test FOR DELETE TO test_schema USING (true);


--
-- Name: test Enable insert for all; Type: POLICY; Schema: test_schema; Owner: postgres
--

CREATE POLICY "Enable insert for all" ON test_schema.test FOR INSERT TO test_schema WITH CHECK (true);


--
-- Name: test Enable read access for all; Type: POLICY; Schema: test_schema; Owner: postgres
--

CREATE POLICY "Enable read access for all" ON test_schema.test FOR SELECT TO test_schema USING (true);


--
-- Name: admin Enable users to view their own data only; Type: POLICY; Schema: test_schema; Owner: postgres
--

CREATE POLICY "Enable users to view their own data only" ON test_schema.admin FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: profile Enable users to view their own data only; Type: POLICY; Schema: test_schema; Owner: postgres
--

CREATE POLICY "Enable users to view their own data only" ON test_schema.profile FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: account_notification; Type: ROW SECURITY; Schema: test_schema; Owner: postgres
--

ALTER TABLE test_schema.account_notification ENABLE ROW LEVEL SECURITY;

--
-- Name: admin; Type: ROW SECURITY; Schema: test_schema; Owner: postgres
--

ALTER TABLE test_schema.admin ENABLE ROW LEVEL SECURITY;

--
-- Name: profile; Type: ROW SECURITY; Schema: test_schema; Owner: postgres
--

ALTER TABLE test_schema.profile ENABLE ROW LEVEL SECURITY;

--
-- Name: role; Type: ROW SECURITY; Schema: test_schema; Owner: postgres
--

ALTER TABLE test_schema.role ENABLE ROW LEVEL SECURITY;

--
-- Name: role_account; Type: ROW SECURITY; Schema: test_schema; Owner: postgres
--

ALTER TABLE test_schema.role_account ENABLE ROW LEVEL SECURITY;

--
-- Name: session; Type: ROW SECURITY; Schema: test_schema; Owner: postgres
--

ALTER TABLE test_schema.session ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA test_schema; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA test_schema TO anon;
GRANT USAGE ON SCHEMA test_schema TO authenticated;
GRANT USAGE ON SCHEMA test_schema TO service_role;


--
-- Name: TABLE account_notification; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.account_notification TO service_role;
GRANT ALL ON TABLE test_schema.account_notification TO anon;
GRANT ALL ON TABLE test_schema.account_notification TO authenticated;


--
-- Name: TABLE admin; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.admin TO service_role;
GRANT ALL ON TABLE test_schema.admin TO anon;
GRANT ALL ON TABLE test_schema.admin TO authenticated;


--
-- Name: TABLE profile; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.profile TO service_role;
GRANT ALL ON TABLE test_schema.profile TO anon;
GRANT ALL ON TABLE test_schema.profile TO authenticated;


--
-- Name: TABLE role; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.role TO service_role;
GRANT ALL ON TABLE test_schema.role TO anon;
GRANT ALL ON TABLE test_schema.role TO authenticated;


--
-- Name: TABLE role_account; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.role_account TO service_role;
GRANT ALL ON TABLE test_schema.role_account TO anon;
GRANT ALL ON TABLE test_schema.role_account TO authenticated;


--
-- Name: TABLE session; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.session TO service_role;
GRANT ALL ON TABLE test_schema.session TO anon;
GRANT ALL ON TABLE test_schema.session TO authenticated;


--
-- Name: TABLE test; Type: ACL; Schema: test_schema; Owner: postgres
--

GRANT ALL ON TABLE test_schema.test TO anon;
GRANT ALL ON TABLE test_schema.test TO authenticated;
GRANT ALL ON TABLE test_schema.test TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: test_schema; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: test_schema; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: test_schema; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA test_schema GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ESDARySEbNiltJxx69hlNCa6Ms5aTMaFJqUYe8bGuTKqw9pb8TWgIFwHwScH70V


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
-- Name: sveltekit_template; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA sveltekit_template;


ALTER SCHEMA sveltekit_template OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_notification; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.account_notification (
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


ALTER TABLE sveltekit_template.account_notification OWNER TO postgres;

--
-- Name: admin; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL
);


ALTER TABLE sveltekit_template.admin OWNER TO postgres;

--
-- Name: profile; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.profile (
    id uuid DEFAULT auth.uid() NOT NULL,
    username text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email character varying DEFAULT ''::character varying NOT NULL
);


ALTER TABLE sveltekit_template.profile OWNER TO postgres;

--
-- Name: role; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    name text NOT NULL,
    description text,
    parent uuid DEFAULT gen_random_uuid(),
    color text
);


ALTER TABLE sveltekit_template.role OWNER TO postgres;

--
-- Name: role_account; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.role_account (
    account_id uuid NOT NULL,
    role_id bigint NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archived boolean DEFAULT false
);


ALTER TABLE sveltekit_template.role_account OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account_id uuid,
    prev_url text,
    archived boolean DEFAULT false NOT NULL
);


ALTER TABLE sveltekit_template.session OWNER TO postgres;

--
-- Name: test; Type: TABLE; Schema: sveltekit_template; Owner: postgres
--

CREATE TABLE sveltekit_template.test (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false,
    name text NOT NULL,
    age integer NOT NULL
);


ALTER TABLE sveltekit_template.test OWNER TO postgres;

--
-- Name: account_notification account_notification_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.account_notification
    ADD CONSTRAINT account_notification_pkey PRIMARY KEY (id);


--
-- Name: admin admins_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.admin
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);


--
-- Name: profile profiles_username_key; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.profile
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: role_account role_account_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.role_account
    ADD CONSTRAINT role_account_pkey PRIMARY KEY (id);


--
-- Name: role roles_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.role
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: test test_pkey; Type: CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.test
    ADD CONSTRAINT test_pkey PRIMARY KEY (id);


--
-- Name: account_notification account_notification_account_id_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.account_notification
    ADD CONSTRAINT account_notification_account_id_fkey FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin admin_id_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.admin
    ADD CONSTRAINT admin_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profile profile_id_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.profile
    ADD CONSTRAINT profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_account role_account_account_id_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.role_account
    ADD CONSTRAINT role_account_account_id_fkey FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role roles_parent_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.role
    ADD CONSTRAINT roles_parent_fkey FOREIGN KEY (parent) REFERENCES sveltekit_template.role(id) ON DELETE CASCADE;


--
-- Name: session session_account_id_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.session
    ADD CONSTRAINT session_account_id_fkey FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session session_id_fkey; Type: FK CONSTRAINT; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE ONLY sveltekit_template.session
    ADD CONSTRAINT session_id_fkey FOREIGN KEY (id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: test Allow update; Type: POLICY; Schema: sveltekit_template; Owner: postgres
--

CREATE POLICY "Allow update" ON sveltekit_template.test FOR UPDATE TO sveltekit_template USING (true);


--
-- Name: test Enable delete for all users; Type: POLICY; Schema: sveltekit_template; Owner: postgres
--

CREATE POLICY "Enable delete for all users" ON sveltekit_template.test FOR DELETE TO sveltekit_template USING (true);


--
-- Name: test Enable insert for all; Type: POLICY; Schema: sveltekit_template; Owner: postgres
--

CREATE POLICY "Enable insert for all" ON sveltekit_template.test FOR INSERT TO sveltekit_template WITH CHECK (true);


--
-- Name: test Enable read access for all; Type: POLICY; Schema: sveltekit_template; Owner: postgres
--

CREATE POLICY "Enable read access for all" ON sveltekit_template.test FOR SELECT TO sveltekit_template USING (true);


--
-- Name: admin Enable users to view their own data only; Type: POLICY; Schema: sveltekit_template; Owner: postgres
--

CREATE POLICY "Enable users to view their own data only" ON sveltekit_template.admin FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: profile Enable users to view their own data only; Type: POLICY; Schema: sveltekit_template; Owner: postgres
--

CREATE POLICY "Enable users to view their own data only" ON sveltekit_template.profile FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: account_notification; Type: ROW SECURITY; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE sveltekit_template.account_notification ENABLE ROW LEVEL SECURITY;

--
-- Name: admin; Type: ROW SECURITY; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE sveltekit_template.admin ENABLE ROW LEVEL SECURITY;

--
-- Name: profile; Type: ROW SECURITY; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE sveltekit_template.profile ENABLE ROW LEVEL SECURITY;

--
-- Name: role; Type: ROW SECURITY; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE sveltekit_template.role ENABLE ROW LEVEL SECURITY;

--
-- Name: role_account; Type: ROW SECURITY; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE sveltekit_template.role_account ENABLE ROW LEVEL SECURITY;

--
-- Name: session; Type: ROW SECURITY; Schema: sveltekit_template; Owner: postgres
--

ALTER TABLE sveltekit_template.session ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA sveltekit_template; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA sveltekit_template TO anon;
GRANT USAGE ON SCHEMA sveltekit_template TO authenticated;
GRANT USAGE ON SCHEMA sveltekit_template TO service_role;


--
-- Name: TABLE account_notification; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.account_notification TO service_role;
GRANT ALL ON TABLE sveltekit_template.account_notification TO anon;
GRANT ALL ON TABLE sveltekit_template.account_notification TO authenticated;


--
-- Name: TABLE admin; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.admin TO service_role;
GRANT ALL ON TABLE sveltekit_template.admin TO anon;
GRANT ALL ON TABLE sveltekit_template.admin TO authenticated;


--
-- Name: TABLE profile; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.profile TO service_role;
GRANT ALL ON TABLE sveltekit_template.profile TO anon;
GRANT ALL ON TABLE sveltekit_template.profile TO authenticated;


--
-- Name: TABLE role; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.role TO service_role;
GRANT ALL ON TABLE sveltekit_template.role TO anon;
GRANT ALL ON TABLE sveltekit_template.role TO authenticated;


--
-- Name: TABLE role_account; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.role_account TO service_role;
GRANT ALL ON TABLE sveltekit_template.role_account TO anon;
GRANT ALL ON TABLE sveltekit_template.role_account TO authenticated;


--
-- Name: TABLE session; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.session TO service_role;
GRANT ALL ON TABLE sveltekit_template.session TO anon;
GRANT ALL ON TABLE sveltekit_template.session TO authenticated;


--
-- Name: TABLE test; Type: ACL; Schema: sveltekit_template; Owner: postgres
--

GRANT ALL ON TABLE sveltekit_template.test TO anon;
GRANT ALL ON TABLE sveltekit_template.test TO authenticated;
GRANT ALL ON TABLE sveltekit_template.test TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: sveltekit_template; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: sveltekit_template; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: sveltekit_template; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sveltekit_template GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict ESDARySEbNiltJxx69hlNCa6Ms5aTMaFJqUYe8bGuTKqw9pb8TWgIFwHwScH70V


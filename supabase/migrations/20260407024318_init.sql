


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


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "test_schema";


ALTER SCHEMA "test_schema" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "test_schema"."account_notification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "icon" "text" NOT NULL,
    "icon_type" "text" NOT NULL,
    "link" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "title" "text" NOT NULL,
    "account_id" "uuid"
);


ALTER TABLE "test_schema"."account_notification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "test_schema"."admin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "test_schema"."admin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "test_schema"."profile" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "email" "text" NOT NULL,
    "username" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL
);


ALTER TABLE "test_schema"."profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "test_schema"."role" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "color" "text" NOT NULL,
    "description" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "test_schema"."role" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "test_schema"."role_account" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "account" "uuid",
    "role" "uuid"
);


ALTER TABLE "test_schema"."role_account" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "test_schema"."session" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "prev_url" "text",
    "account_id" "uuid"
);


ALTER TABLE "test_schema"."session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "test_schema"."test" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "age" bigint NOT NULL
);


ALTER TABLE "test_schema"."test" OWNER TO "postgres";


ALTER TABLE ONLY "test_schema"."account_notification"
    ADD CONSTRAINT "account_notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."admin"
    ADD CONSTRAINT "admin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."role_account"
    ADD CONSTRAINT "role_account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."test"
    ADD CONSTRAINT "test_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "test_schema"."account_notification"
    ADD CONSTRAINT "account_notification_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "test_schema"."admin"
    ADD CONSTRAINT "admin_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "test_schema"."profile"
    ADD CONSTRAINT "profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "test_schema"."role_account"
    ADD CONSTRAINT "role_account_account_fkey" FOREIGN KEY ("account") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "test_schema"."role_account"
    ADD CONSTRAINT "role_account_role_fkey" FOREIGN KEY ("role") REFERENCES "test_schema"."role"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "test_schema"."session"
    ADD CONSTRAINT "session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "test_schema"."account_notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "test_schema"."admin" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "test_schema"."profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "test_schema"."role" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "test_schema"."role_account" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "test_schema"."session" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "test_schema"."test" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."account_notification";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."admin";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."profile";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."role";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."role_account";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."session";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "test_schema"."test";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "test_schema" TO "anon";
GRANT USAGE ON SCHEMA "test_schema" TO "authenticated";
GRANT USAGE ON SCHEMA "test_schema" TO "service_role";
































































































































































































GRANT ALL ON TABLE "test_schema"."account_notification" TO "anon";
GRANT ALL ON TABLE "test_schema"."account_notification" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."account_notification" TO "service_role";



GRANT ALL ON TABLE "test_schema"."admin" TO "anon";
GRANT ALL ON TABLE "test_schema"."admin" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."admin" TO "service_role";



GRANT ALL ON TABLE "test_schema"."profile" TO "anon";
GRANT ALL ON TABLE "test_schema"."profile" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."profile" TO "service_role";



GRANT ALL ON TABLE "test_schema"."role" TO "anon";
GRANT ALL ON TABLE "test_schema"."role" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."role" TO "service_role";



GRANT ALL ON TABLE "test_schema"."role_account" TO "anon";
GRANT ALL ON TABLE "test_schema"."role_account" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."role_account" TO "service_role";



GRANT ALL ON TABLE "test_schema"."session" TO "anon";
GRANT ALL ON TABLE "test_schema"."session" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."session" TO "service_role";



GRANT ALL ON TABLE "test_schema"."test" TO "anon";
GRANT ALL ON TABLE "test_schema"."test" TO "authenticated";
GRANT ALL ON TABLE "test_schema"."test" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "test_schema" GRANT ALL ON TABLES TO "service_role";
































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



CREATE SCHEMA IF NOT EXISTS "tators_app_kit";


ALTER SCHEMA "tators_app_kit" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."account_notification" (
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


ALTER TABLE "tators_app_kit"."account_notification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."admin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "tators_app_kit"."admin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."profile" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "email" "text" NOT NULL,
    "username" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL
);


ALTER TABLE "tators_app_kit"."profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."role" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "color" "text" NOT NULL,
    "description" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "tators_app_kit"."role" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."role_account" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "account" "uuid",
    "role" "uuid"
);


ALTER TABLE "tators_app_kit"."role_account" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."session" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "prev_url" "text",
    "account_id" "uuid"
);


ALTER TABLE "tators_app_kit"."session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "tators_app_kit"."test" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archive" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "age" bigint NOT NULL
);


ALTER TABLE "tators_app_kit"."test" OWNER TO "postgres";


ALTER TABLE ONLY "tators_app_kit"."account_notification"
    ADD CONSTRAINT "account_notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."admin"
    ADD CONSTRAINT "admin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."role_account"
    ADD CONSTRAINT "role_account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."test"
    ADD CONSTRAINT "test_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "tators_app_kit"."account_notification"
    ADD CONSTRAINT "account_notification_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tators_app_kit"."admin"
    ADD CONSTRAINT "admin_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tators_app_kit"."profile"
    ADD CONSTRAINT "profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tators_app_kit"."role_account"
    ADD CONSTRAINT "role_account_account_fkey" FOREIGN KEY ("account") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tators_app_kit"."role_account"
    ADD CONSTRAINT "role_account_role_fkey" FOREIGN KEY ("role") REFERENCES "tators_app_kit"."role"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "tators_app_kit"."session"
    ADD CONSTRAINT "session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "tators_app_kit"."account_notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "tators_app_kit"."admin" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "tators_app_kit"."profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "tators_app_kit"."role" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "tators_app_kit"."role_account" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "tators_app_kit"."session" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "tators_app_kit"."test" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."account_notification";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."admin";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."profile";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."role";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."role_account";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."session";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "tators_app_kit"."test";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "tators_app_kit" TO "anon";
GRANT USAGE ON SCHEMA "tators_app_kit" TO "authenticated";
GRANT USAGE ON SCHEMA "tators_app_kit" TO "service_role";
































































































































































































GRANT ALL ON TABLE "tators_app_kit"."account_notification" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."account_notification" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."account_notification" TO "service_role";



GRANT ALL ON TABLE "tators_app_kit"."admin" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."admin" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."admin" TO "service_role";



GRANT ALL ON TABLE "tators_app_kit"."profile" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."profile" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."profile" TO "service_role";



GRANT ALL ON TABLE "tators_app_kit"."role" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."role" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."role" TO "service_role";



GRANT ALL ON TABLE "tators_app_kit"."role_account" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."role_account" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."role_account" TO "service_role";



GRANT ALL ON TABLE "tators_app_kit"."session" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."session" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."session" TO "service_role";



GRANT ALL ON TABLE "tators_app_kit"."test" TO "anon";
GRANT ALL ON TABLE "tators_app_kit"."test" TO "authenticated";
GRANT ALL ON TABLE "tators_app_kit"."test" TO "service_role";









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






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "tators_app_kit" GRANT ALL ON TABLES TO "service_role";





























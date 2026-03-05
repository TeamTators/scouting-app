#!/usr/bin/env bash

psql -U postgres -d postgres -f supabase/roles.sql
psql -U postgres -d postgres -f supabase/extensions.sql
psql -U postgres -d postgres -f supabase/schema.sql
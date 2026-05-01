SELECT 
    r.rolname, 
    has_schema_privilege(r.rolname, 'test', 'usage') AS has_usage
FROM (
    SELECT 'anon' AS rolname 
    UNION ALL SELECT 'authenticated' 
    UNION ALL SELECT 'service_role' 
    UNION ALL SELECT 'authenticator'
) r;
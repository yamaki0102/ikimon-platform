DO $$
DECLARE
    role_name TEXT;
BEGIN
    FOR role_name IN
        SELECT rolname
        FROM pg_roles
        WHERE rolcanlogin
          AND has_table_privilege(rolname, 'places', 'SELECT')
    LOOP
        EXECUTE format(
            'GRANT SELECT ON TABLE monitoring_plots, monitoring_plot_visits TO %I',
            role_name
        );
    END LOOP;

    FOR role_name IN
        SELECT rolname
        FROM pg_roles
        WHERE rolcanlogin
          AND has_table_privilege(rolname, 'place_conditions', 'INSERT')
    LOOP
        EXECUTE format(
            'GRANT INSERT, UPDATE, DELETE ON TABLE monitoring_plots, monitoring_plot_visits TO %I',
            role_name
        );
    END LOOP;
END $$;

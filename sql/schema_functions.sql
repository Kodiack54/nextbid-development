-- Schema Refresh Functions
-- Run this in Supabase SQL Editor to enable schema refresh from the UI

-- ============================================
-- Function: Get all columns for tables with a prefix
-- ============================================
CREATE OR REPLACE FUNCTION get_columns_for_prefix(prefix TEXT)
RETURNS TABLE (
    table_name TEXT,
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.table_name::TEXT,
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE prefix || '_%'
    ORDER BY c.table_name, c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: Refresh all project schemas
-- This scans the database and updates dev_projects.database_schema
-- ============================================
CREATE OR REPLACE FUNCTION refresh_all_project_schemas()
RETURNS JSONB AS $$
DECLARE
    proj RECORD;
    col RECORD;
    schema_obj JSONB;
    table_obj JSONB;
    current_table TEXT;
    updated_count INT := 0;
BEGIN
    -- Loop through all projects with a table_prefix
    FOR proj IN
        SELECT id, name, table_prefix
        FROM dev_projects
        WHERE table_prefix IS NOT NULL AND table_prefix != ''
    LOOP
        schema_obj := '{}'::JSONB;
        current_table := '';

        -- Get all columns for this prefix
        FOR col IN
            SELECT
                c.table_name,
                c.column_name,
                c.data_type
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name LIKE proj.table_prefix || '_%'
            ORDER BY c.table_name, c.ordinal_position
        LOOP
            -- New table encountered
            IF current_table != col.table_name THEN
                current_table := col.table_name;
                table_obj := jsonb_build_object(
                    'columns', '[]'::JSONB,
                    'types', '{}'::JSONB
                );
            END IF;

            -- Add column to table object
            table_obj := jsonb_set(
                table_obj,
                '{columns}',
                (table_obj->'columns') || to_jsonb(col.column_name)
            );
            table_obj := jsonb_set(
                table_obj,
                ARRAY['types', col.column_name],
                to_jsonb(col.data_type)
            );

            -- Update schema object
            schema_obj := jsonb_set(schema_obj, ARRAY[col.table_name], table_obj);
        END LOOP;

        -- Update the project
        UPDATE dev_projects
        SET database_schema = schema_obj
        WHERE id = proj.id;

        updated_count := updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'projects_updated', updated_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: Get schema info (simple version)
-- Returns a flat list of all tables and their columns
-- ============================================
CREATE OR REPLACE FUNCTION get_schema_info()
RETURNS TABLE (
    table_name TEXT,
    column_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.table_name::TEXT,
        COUNT(c.column_name)::INT as column_count
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
    ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Grant execute permissions
-- ============================================
GRANT EXECUTE ON FUNCTION get_columns_for_prefix(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_columns_for_prefix(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_all_project_schemas() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_project_schemas() TO service_role;
GRANT EXECUTE ON FUNCTION get_schema_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_schema_info() TO service_role;

-- ============================================
-- Done! Now the "Rescan DB" button will work
-- ============================================

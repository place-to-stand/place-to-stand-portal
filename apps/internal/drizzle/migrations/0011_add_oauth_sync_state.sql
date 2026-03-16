-- Add sync_state column to oauth_connections (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_connections' AND table_schema = 'public') THEN
        -- Check if column already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'oauth_connections'
            AND column_name = 'sync_state'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE "oauth_connections" ADD COLUMN "sync_state" jsonb DEFAULT '{}'::jsonb NOT NULL;
        END IF;
    END IF;
END $$;

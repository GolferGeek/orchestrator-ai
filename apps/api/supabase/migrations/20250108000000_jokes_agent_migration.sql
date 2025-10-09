-- Jokes Agent Migration
-- Creates the necessary database structure for the Productivity Jokes Agent

-- Create jokes_agent table to store joke history and sessions
CREATE TABLE IF NOT EXISTS jokes_agent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    joke_output TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_jokes_agent_session_id ON jokes_agent(session_id);
CREATE INDEX IF NOT EXISTS idx_jokes_agent_created_at ON jokes_agent(created_at);

-- Create RLS policies for jokes_agent table
ALTER TABLE jokes_agent ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read their own jokes
CREATE POLICY "Users can view their own jokes" ON jokes_agent
    FOR SELECT USING (auth.uid()::text = session_id OR session_id LIKE 'session_%');

-- Policy to allow authenticated users to insert jokes
CREATE POLICY "Users can insert jokes" ON jokes_agent
    FOR INSERT WITH CHECK (true);

-- Create function to clean up old joke records (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_jokes()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM jokes_agent 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Create a scheduled job to run cleanup weekly (if pg_cron is available)
-- SELECT cron.schedule('cleanup-jokes', '0 2 * * 0', 'SELECT cleanup_old_jokes();');

-- Insert some sample fallback jokes for error handling
INSERT INTO jokes_agent (session_id, prompt, joke_output) VALUES
('fallback', 'error_fallback', 'Why don''t productivity apps ever get stressed? Because they know how to delegate their tasks!'),
('fallback', 'error_fallback', 'What do you call a programmer who doesn''t comment their code? A mystery novelist!'),
('fallback', 'error_fallback', 'Why did the spreadsheet go to therapy? It had too many cells of anxiety!'),
('fallback', 'error_fallback', 'How do you comfort a JavaScript bug? You console it!'),
('fallback', 'error_fallback', 'Why don''t databases ever get lonely? Because they always have relationships!')
ON CONFLICT DO NOTHING;

-- Create a view for joke analytics
CREATE OR REPLACE VIEW jokes_analytics AS
SELECT 
    DATE(created_at) as joke_date,
    COUNT(*) as total_jokes,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG(LENGTH(joke_output)) as avg_joke_length
FROM jokes_agent 
WHERE session_id != 'fallback'
GROUP BY DATE(created_at)
ORDER BY joke_date DESC;

-- Grant permissions
GRANT SELECT, INSERT ON jokes_agent TO authenticated;
GRANT SELECT ON jokes_analytics TO authenticated;

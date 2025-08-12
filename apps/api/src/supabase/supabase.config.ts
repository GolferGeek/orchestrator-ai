import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => {
  const mode = process.env.SUPABASE_MODE || 'cloud';

  if (mode === 'local') {
    // Simple single-instance configuration for demo/playground
    return {
      mode: 'local',
      url: process.env.SUPABASE_LOCAL_URL || 'http://localhost:9010',
      anonKey:
        process.env.SUPABASE_LOCAL_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      serviceKey:
        process.env.SUPABASE_LOCAL_SERVICE_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      database: process.env.SUPABASE_LOCAL_DB || 'orchestrator_ai_demo',
    };
  }

  // Default to cloud mode
  return {
    mode: 'cloud',
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    database: null, // Cloud uses project URL routing
  };
});

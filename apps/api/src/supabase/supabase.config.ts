import { registerAs } from '@nestjs/config';

// Helper function to get schema-aware table name
// Returns just the table name since Supabase client handles schema via .schema() method
export function getTableName(tableName: string, schema?: string): string {
  // Just return the table name - schema will be handled by the client
  return tableName;
}

// Helper function to get the appropriate schema for a table
export function getSchemaForTable(tableName: string, explicitSchema?: string): string {
  // Defer environment variable access to runtime
  const getCoreSchema = () => process.env.SUPABASE_CORE_SCHEMA || 'public';
  const getCompanySchema = () => process.env.SUPABASE_COMPANY_SCHEMA || 'public';
  
  // Company-specific tables
  const companyTables = [
    'companies',
    'industry_standard_kpis',
    'company_kpis',
    'kpi_data'
  ];
  
  if (companyTables.includes(tableName)) {
    return getCompanySchema();
  }
  
  // Use explicit schema if provided
  if (explicitSchema) {
    return explicitSchema;
  }
  
  // Default to core schema for all other tables
  return getCoreSchema();
}

// Lazy configuration loading - defer all environment access
export default registerAs('supabase', () => {
  const getEnvValue = (key: string, defaultValue: string) => {
    try {
      return process.env[key] || defaultValue;
    } catch (error) {
      return defaultValue;
    }
  };

  return {
    url: getEnvValue('SUPABASE_URL', 'http://localhost:9010'),
    anonKey: getEnvValue('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'),
    serviceKey: getEnvValue('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'),
    jwtSecret: getEnvValue('SUPABASE_JWT_SECRET', 'super-secret-jwt-token-with-at-least-32-characters-long'),
    coreSchema: getEnvValue('SUPABASE_CORE_SCHEMA', 'public'),
    companySchema: getEnvValue('SUPABASE_COMPANY_SCHEMA', 'public'),
  };
});
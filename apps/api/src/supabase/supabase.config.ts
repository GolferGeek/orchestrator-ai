import { registerAs } from '@nestjs/config';

// Helper function to get schema-aware table name
// Returns just the table name since Supabase client handles schema via .schema() method
export function getTableName(tableName: string, schema?: string): string {
  // Just return the table name - schema will be handled by the client
  return tableName;
}

// Helper function to get the appropriate schema for a table
export function getSchemaForTable(tableName: string, explicitSchema?: string): string {
  const coreSchema = process.env.SUPABASE_CORE_SCHEMA;
  const companySchema = process.env.SUPABASE_COMPANY_SCHEMA;
  
  if (!coreSchema || !companySchema) {
    throw new Error('SUPABASE_CORE_SCHEMA and SUPABASE_COMPANY_SCHEMA must be set in environment');
  }
  
  // Company-specific tables
  const companyTables = [
    'companies',
    'industry_standard_kpis',
    'company_kpis',
    'kpi_data'
  ];
  
  if (companyTables.includes(tableName)) {
    return companySchema;
  }
  
  // Use explicit schema if provided
  if (explicitSchema) {
    return explicitSchema;
  }
  
  // Default to core schema for all other tables
  return coreSchema;
}

export default registerAs('supabase', () => {
  const coreSchema = process.env.SUPABASE_CORE_SCHEMA;
  const companySchema = process.env.SUPABASE_COMPANY_SCHEMA;
  
  if (!coreSchema || !companySchema) {
    throw new Error('SUPABASE_CORE_SCHEMA and SUPABASE_COMPANY_SCHEMA must be set in environment');
  }
  
  return {
    url: process.env.SUPABASE_URL || 'http://localhost:9010',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long',
    coreSchema,
    companySchema,
  };
});

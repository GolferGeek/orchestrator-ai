

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






COMMENT ON SCHEMA "public" IS 'Schema updated with comprehensive sample data for frontend component testing - Migration 20250904205911';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."pii_data_type" AS ENUM (
    'email',
    'phone',
    'name',
    'address',
    'ip_address',
    'username',
    'credit_card',
    'ssn',
    'custom'
);


ALTER TYPE "public"."pii_data_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_sanitization_score"("p_pii_detected" boolean, "p_sanitization_level" character varying, "p_redactions_applied" integer, "p_pseudonyms_used" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Points for sanitization level
    score := CASE p_sanitization_level
        WHEN 'strict' THEN score + 40
        WHEN 'standard' THEN score + 30
        WHEN 'basic' THEN score + 20
        WHEN 'none' THEN score + 0
        ELSE score
    END;
    
    -- Points for PII handling
    IF p_pii_detected THEN
        IF p_pseudonyms_used > 0 THEN
            score := score + 25;
        END IF;
        IF p_redactions_applied > 0 THEN
            score := score + 25;
        END IF;
    ELSE
        -- No PII detected gets full score
        score := score + 50;
    END IF;
    
    -- Bonus for comprehensive sanitization
    IF p_redactions_applied > 0 AND p_pseudonyms_used > 0 THEN
        score := score + 10;
    END IF;
    
    RETURN LEAST(score, 100); -- Cap at 100
END;
$$;


ALTER FUNCTION "public"."calculate_sanitization_score"("p_pii_detected" boolean, "p_sanitization_level" character varying, "p_redactions_applied" integer, "p_pseudonyms_used" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_deliverable_version"("deliverable_uuid" "uuid", "version_content" "text", "version_format" character varying DEFAULT NULL::character varying, "creation_type" character varying DEFAULT 'ai_response'::character varying, "version_task_id" "uuid" DEFAULT NULL::"uuid", "version_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    next_version_number INTEGER;
    new_version_id UUID;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version_number
    FROM public.deliverable_versions
    WHERE deliverable_id = deliverable_uuid;
    
    -- Unset current version flag on existing versions
    UPDATE public.deliverable_versions 
    SET is_current_version = false
    WHERE deliverable_id = deliverable_uuid 
      AND is_current_version = true;
    
    -- Create new version
    INSERT INTO public.deliverable_versions (
        deliverable_id,
        version_number,
        content,
        format,
        created_by_type,
        task_id,
        metadata,
        is_current_version
    ) VALUES (
        deliverable_uuid,
        next_version_number,
        version_content,
        version_format,
        creation_type,
        version_task_id,
        version_metadata,
        true
    ) RETURNING id INTO new_version_id;
    
    RETURN new_version_id;
END;
$$;


ALTER FUNCTION "public"."create_deliverable_version"("deliverable_uuid" "uuid", "version_content" "text", "version_format" character varying, "creation_type" character varying, "version_task_id" "uuid", "version_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_deliverable_version"("deliverable_uuid" "uuid", "version_content" "text", "version_format" character varying, "creation_type" character varying, "version_task_id" "uuid", "version_metadata" "jsonb") IS 'Helper function to create new deliverable version with proper version numbering and current flag management. Allowed creation_type values: ai_response, manual_edit, ai_enhancement, user_request, conversation_task, conversation_merge';



CREATE OR REPLACE FUNCTION "public"."exec_sql"("query" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result json;
BEGIN
    -- Execute the dynamic SQL and return results as JSON
    EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
    
    -- If no rows returned, return empty array instead of null
    IF result IS NULL THEN
        result := '[]'::json;
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information as JSON
        RETURN json_build_object(
            'error', true,
            'message', SQLERRM,
            'code', SQLSTATE,
            'query', query
        );
END;
$$;


ALTER FUNCTION "public"."exec_sql"("query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."exec_sql"("query" "text") IS 'Execute arbitrary SQL queries and return results as JSON array. Used by MCP server for dynamic query execution.';



CREATE OR REPLACE FUNCTION "public"."get_compliance_status"("p_llm_usage_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    usage_record RECORD;
    compliance_status JSONB := '{}'::jsonb;
BEGIN
    SELECT * FROM public.llm_usage WHERE id = p_llm_usage_id INTO usage_record;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Usage record not found"}'::jsonb;
    END IF;
    
    -- GDPR compliance (requires data sanitization for PII)
    compliance_status := compliance_status || jsonb_build_object(
        'gdpr_compliant',
        CASE 
            WHEN usage_record.pii_detected = false THEN true
            WHEN usage_record.pii_detected = true AND usage_record.data_sanitization_applied = true THEN true
            ELSE false
        END
    );
    
    -- HIPAA compliance (requires strict sanitization)
    compliance_status := compliance_status || jsonb_build_object(
        'hipaa_compliant',
        CASE 
            WHEN usage_record.sanitization_level = 'strict' THEN true
            ELSE false
        END
    );
    
    -- PCI compliance (requires redaction of payment data)
    compliance_status := compliance_status || jsonb_build_object(
        'pci_compliant',
        CASE 
            WHEN usage_record.redaction_types ? 'credit_card' OR usage_record.redaction_types ? 'payment_info' THEN true
            WHEN NOT (usage_record.pii_types ? 'credit_card') THEN true
            ELSE false
        END
    );
    
    -- Overall sanitization score
    compliance_status := compliance_status || jsonb_build_object(
        'sanitization_score',
        public.calculate_sanitization_score(
            usage_record.pii_detected,
            usage_record.sanitization_level,
            usage_record.redactions_applied,
            usage_record.pseudonyms_used
        )
    );
    
    RETURN compliance_status;
END;
$$;


ALTER FUNCTION "public"."get_compliance_status"("p_llm_usage_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_deliverable_version"("deliverable_uuid" "uuid") RETURNS TABLE("id" "uuid", "version_number" integer, "content" "text", "format" character varying, "created_by_type" character varying, "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dv.id,
        dv.version_number,
        dv.content,
        dv.format,
        dv.created_by_type,
        dv.metadata,
        dv.created_at
    FROM public.deliverable_versions dv
    WHERE dv.deliverable_id = deliverable_uuid
      AND dv.is_current_version = true;
END;
$$;


ALTER FUNCTION "public"."get_current_deliverable_version"("deliverable_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_usage_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update usage count and last used timestamp
    NEW.usage_count = COALESCE(OLD.usage_count, 0) + 1;
    NEW.last_used_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_usage_counter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_llm_usage_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_llm_usage_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "agent_name" character varying(255),
    "agent_type" character varying(100),
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "last_active_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "primary_work_product_id" "uuid",
    "primary_work_product_type" character varying(100),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."agent_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_conversations" IS 'Agent conversations table - cleaned for new deliverables versioning system';



CREATE TABLE IF NOT EXISTS "public"."cidafm_commands" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "type" character varying(10) NOT NULL,
    "description" "text",
    "default_active" boolean DEFAULT false,
    "is_builtin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."cidafm_commands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "industry" character varying(100),
    "founded_year" integer,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON TABLE "public"."companies" IS 'Moved from company schema - contains company information for KPI tracking';



CREATE TABLE IF NOT EXISTS "public"."deliverable_versions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content" "text",
    "format" character varying(100),
    "is_current_version" boolean DEFAULT false,
    "created_by_type" character varying(50) DEFAULT 'ai_response'::character varying,
    "task_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "file_attachments" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliverable_versions_created_by_type_check" CHECK ((("created_by_type")::"text" = ANY ((ARRAY['ai_response'::character varying, 'manual_edit'::character varying, 'ai_enhancement'::character varying, 'user_request'::character varying, 'conversation_task'::character varying, 'conversation_merge'::character varying])::"text"[])))
);


ALTER TABLE "public"."deliverable_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."deliverable_versions" IS 'Version data for deliverables - each deliverable can have multiple versions';



COMMENT ON COLUMN "public"."deliverable_versions"."is_current_version" IS 'Only one version per deliverable can be current (enforced by unique constraint)';



COMMENT ON COLUMN "public"."deliverable_versions"."created_by_type" IS 'How this version was created: ai_response, manual_edit, ai_enhancement, user_request';



CREATE TABLE IF NOT EXISTS "public"."deliverables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "uuid",
    "title" character varying(255) NOT NULL,
    "deliverable_type" character varying(100),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "project_step_id" "uuid",
    "agent_name" character varying(255),
    "task_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."deliverables" OWNER TO "postgres";


COMMENT ON TABLE "public"."deliverables" IS 'Deliverables table - prepared for new versioning system where each conversation has one deliverable with multiple versions';



COMMENT ON COLUMN "public"."deliverables"."agent_name" IS 'Agent that should handle editing this deliverable (inherited from creating conversation)';



COMMENT ON COLUMN "public"."deliverables"."task_id" IS 'References the task that created this deliverable, used for task-based evaluation';



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "name" character varying(255) NOT NULL,
    "head_of_department" character varying(255),
    "budget" numeric(15,2),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


COMMENT ON TABLE "public"."departments" IS 'Moved from company schema - contains department information';



CREATE TABLE IF NOT EXISTS "public"."human_inputs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "options" "jsonb",
    "user_response" "text",
    "response_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "timeout_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "human_inputs_request_type_check" CHECK (("request_type" = ANY (ARRAY['confirmation'::"text", 'choice'::"text", 'input'::"text", 'approval'::"text"]))),
    CONSTRAINT "human_inputs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'timeout'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."human_inputs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_data" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "department_id" "uuid",
    "metric_id" "uuid",
    "value" numeric(15,4) NOT NULL,
    "date_recorded" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."kpi_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_data" IS 'Moved from company schema - contains actual KPI data points';



CREATE TABLE IF NOT EXISTS "public"."kpi_goals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "department_id" "uuid",
    "metric_id" "uuid",
    "target_value" numeric(15,4),
    "period_start" "date",
    "period_end" "date",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."kpi_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_goals" IS 'Moved from company schema - contains KPI targets and goals';



CREATE TABLE IF NOT EXISTS "public"."kpi_metrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "metric_type" character varying(100),
    "unit" character varying(50),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."kpi_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_metrics" IS 'Moved from company schema - contains KPI metric definitions';



CREATE TABLE IF NOT EXISTS "public"."langgraph_states" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "plan_state" "jsonb",
    "step_results" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "state_version" integer DEFAULT 1,
    "last_synchronized" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."langgraph_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."llm_models" (
    "model_name" "text" NOT NULL,
    "provider_name" "text" NOT NULL,
    "display_name" "text",
    "model_type" "text" DEFAULT 'text-generation'::"text",
    "model_version" "text",
    "context_window" integer DEFAULT 4096,
    "max_output_tokens" integer DEFAULT 2048,
    "model_parameters_json" "jsonb" DEFAULT '{}'::"jsonb",
    "pricing_info_json" "jsonb" DEFAULT '{}'::"jsonb",
    "capabilities" "jsonb" DEFAULT '[]'::"jsonb",
    "is_local" boolean DEFAULT false,
    "is_currently_loaded" boolean DEFAULT false,
    "model_tier" "text",
    "speed_tier" "text" DEFAULT 'medium'::"text",
    "loading_priority" integer DEFAULT 5,
    "is_active" boolean DEFAULT true,
    "training_data_cutoff" "date",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."llm_models" OWNER TO "postgres";


COMMENT ON TABLE "public"."llm_models" IS 'LLM models with corrected Anthropic naming (hyphens not dots) - 2025-09-07 fix';



COMMENT ON COLUMN "public"."llm_models"."speed_tier" IS 'Performance tier: ultra-fast (< 1s), fast (1-3s), medium (3-10s), slow (10s+)';



CREATE TABLE IF NOT EXISTS "public"."llm_models_backup" (
    "id" "uuid",
    "provider_id" "uuid",
    "model_name" character varying(255),
    "display_name" character varying(255),
    "model_type" character varying(100),
    "context_window" integer,
    "max_output_tokens" integer,
    "model_parameters_json" "jsonb",
    "pricing_info_json" "jsonb",
    "capabilities" "jsonb",
    "is_active" boolean,
    "model_version" character varying(100),
    "training_data_cutoff" "date",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "is_local" boolean,
    "is_currently_loaded" boolean,
    "model_tier" character varying(50),
    "loading_priority" integer,
    "capabilities_json" "jsonb",
    "complexity_level" "text",
    "thinking_mode" boolean,
    "speed_tier" "text",
    "resource_requirements" "jsonb"
);


ALTER TABLE "public"."llm_models_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."llm_providers" (
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "api_base_url" "text",
    "configuration_json" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."llm_providers" OWNER TO "postgres";


COMMENT ON TABLE "public"."llm_providers" IS 'LLM providers using name-based system (no UUIDs) - 2025 refresh';



CREATE TABLE IF NOT EXISTS "public"."llm_providers_backup" (
    "id" "uuid",
    "name" character varying(255),
    "display_name" character varying(255),
    "api_base_url" character varying(500),
    "api_key_encrypted" "text",
    "configuration_json" "jsonb",
    "is_active" boolean,
    "rate_limit_rpm" integer,
    "rate_limit_tpm" integer,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."llm_providers_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."llm_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "request_timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "response_timestamp" timestamp with time zone,
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "total_tokens" integer GENERATED ALWAYS AS (("input_tokens" + "output_tokens")) STORED,
    "estimated_cost" numeric(10,6) DEFAULT 0,
    "request_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "response_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."llm_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."llm_usage" IS 'LLM usage tracking using name-based provider/model references - 2025 refresh';



CREATE TABLE IF NOT EXISTS "public"."llm_usage_backup" (
    "id" "uuid",
    "run_id" character varying(255),
    "user_id" "uuid",
    "caller_type" character varying(100),
    "caller_name" character varying(255),
    "conversation_id" "uuid",
    "provider_id" "uuid",
    "model_id" "uuid",
    "provider_name" character varying(255),
    "model_name" character varying(255),
    "is_local" boolean,
    "model_tier" character varying(50),
    "fallback_used" boolean,
    "routing_reason" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "total_tokens" integer,
    "input_cost" numeric(10,6),
    "output_cost" numeric(10,6),
    "total_cost" numeric(10,6),
    "duration_ms" integer,
    "response_time_ms" integer,
    "status" character varying(50),
    "error_message" "text",
    "complexity_level" character varying(20),
    "complexity_score" integer,
    "data_classification" character varying(50),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "data_sanitization_applied" boolean,
    "sanitization_level" character varying(20),
    "pii_detected" boolean,
    "pii_types" "jsonb",
    "pseudonyms_used" integer,
    "pseudonym_types" "jsonb",
    "redactions_applied" integer,
    "redaction_types" "jsonb",
    "source_blinding_applied" boolean,
    "headers_stripped" integer,
    "custom_user_agent_used" boolean,
    "proxy_used" boolean,
    "no_train_header_sent" boolean,
    "no_retain_header_sent" boolean,
    "sanitization_time_ms" integer,
    "reversal_context_size" integer,
    "policy_profile" character varying(100),
    "sovereign_mode" boolean,
    "compliance_flags" "jsonb",
    "langsmith_run_id" "uuid",
    "metadata" "jsonb"
);


ALTER TABLE "public"."llm_usage_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "step_id" "text" NOT NULL,
    "step_index" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "step_name" "text" NOT NULL,
    "agent_name" "text",
    "prompt" "text",
    "dependencies" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result" "jsonb",
    "error_details" "jsonb",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_steps_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "project_steps_step_type_check" CHECK (("step_type" = ANY (ARRAY['agent_step'::"text", 'human_approval'::"text"])))
);


ALTER TABLE "public"."project_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_steps" IS 'Individual steps within multi-step projects, enabling complex orchestration workflows with agent execution and human approval points';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'planning'::character varying,
    "plan_json" "jsonb",
    "current_step_id" "text",
    "parent_project_id" "uuid",
    "hierarchy_level" integer DEFAULT 0,
    "subproject_count" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "error_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pseudonym_dictionaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "original_value" character varying(500) NOT NULL,
    "pseudonym" character varying(500) NOT NULL,
    "data_type" "public"."pii_data_type" NOT NULL,
    "category" character varying(100),
    "locale" character varying(10) DEFAULT 'en-US'::character varying,
    "frequency_weight" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."pseudonym_dictionaries" OWNER TO "postgres";


COMMENT ON TABLE "public"."pseudonym_dictionaries" IS 'Dictionary data for generating realistic pseudonyms';



CREATE TABLE IF NOT EXISTS "public"."pseudonym_mappings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "original_hash" character varying(64) NOT NULL,
    "pseudonym" character varying(500) NOT NULL,
    "data_type" "public"."pii_data_type" NOT NULL,
    "context" character varying(255),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "usage_count" integer DEFAULT 1,
    "expires_at" timestamp with time zone,
    "is_reversible" boolean DEFAULT false,
    "created_by_system" character varying(100) DEFAULT 'secret_redaction_service'::character varying
);


ALTER TABLE "public"."pseudonym_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."pseudonym_mappings" IS 'Mapping table from original PII hashes to consistent pseudonyms';



COMMENT ON COLUMN "public"."pseudonym_mappings"."original_hash" IS 'SHA-256 hash of original PII value for consistent lookup';



COMMENT ON COLUMN "public"."pseudonym_mappings"."is_reversible" IS 'Whether original value is stored in vault for authorized reversal';



CREATE TABLE IF NOT EXISTS "public"."redaction_audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" character varying(255),
    "run_id" "uuid",
    "operation_type" character varying(50) NOT NULL,
    "data_type" "public"."pii_data_type",
    "pattern_name" character varying(255),
    "original_length" integer,
    "redacted_length" integer,
    "pseudonym_count" integer DEFAULT 0,
    "redaction_count" integer DEFAULT 0,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "user_id" "uuid",
    "service_name" character varying(100) DEFAULT 'secret_redaction_service'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."redaction_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."redaction_audit_log" IS 'Audit trail for all redaction and pseudonymization operations';



CREATE TABLE IF NOT EXISTS "public"."redaction_patterns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "pattern_regex" "text" NOT NULL,
    "replacement" character varying(500) NOT NULL,
    "description" "text",
    "category" character varying(100) DEFAULT 'custom'::character varying,
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 100,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "usage_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "severity" character varying(50),
    "data_type" character varying(50)
);


ALTER TABLE "public"."redaction_patterns" OWNER TO "postgres";


COMMENT ON TABLE "public"."redaction_patterns" IS 'Custom redaction patterns extending built-in SecretRedactionService patterns';



CREATE TABLE IF NOT EXISTS "public"."role_audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "admin_user_id" "uuid",
    "action" character varying(50),
    "old_roles" "text",
    "new_roles" "text",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."role_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sensitive_data_vault" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pseudonym_mapping_id" "uuid",
    "encrypted_original" "text",
    "encryption_key_id" character varying(100),
    "access_level" character varying(50) DEFAULT 'admin_only'::character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "accessed_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    "retention_until" timestamp with time zone
);


ALTER TABLE "public"."sensitive_data_vault" OWNER TO "postgres";


COMMENT ON TABLE "public"."sensitive_data_vault" IS 'Encrypted storage for reversible pseudonyms (admin access only)';



COMMENT ON COLUMN "public"."sensitive_data_vault"."encrypted_original" IS 'AES encrypted original PII value';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "agent_conversation_id" "uuid",
    "method" character varying(255),
    "params" "jsonb",
    "prompt" "text",
    "response" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "progress" integer DEFAULT 0,
    "progress_message" "text",
    "error_code" character varying(100),
    "error_message" "text",
    "error_data" "jsonb",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "timeout_seconds" integer,
    "deliverable_type" character varying(100),
    "deliverable_metadata" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "llm_metadata" "jsonb",
    "response_metadata" "jsonb",
    "evaluation" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_cidafm_commands" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "command_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_cidafm_commands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "display_name" character varying(255),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "phone" character varying(50),
    "phone_verified" boolean DEFAULT false,
    "company" character varying(255),
    "role" character varying(50),
    "department" character varying(255),
    "location" character varying(255),
    "timezone" character varying(50) DEFAULT 'UTC'::character varying,
    "locale" character varying(10) DEFAULT 'en-US'::character varying,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "roles" "jsonb" DEFAULT '["user"]'::"jsonb"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cidafm_commands"
    ADD CONSTRAINT "cidafm_commands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."cidafm_commands"
    ADD CONSTRAINT "cidafm_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."human_inputs"
    ADD CONSTRAINT "human_inputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_data"
    ADD CONSTRAINT "kpi_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_metrics"
    ADD CONSTRAINT "kpi_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."langgraph_states"
    ADD CONSTRAINT "langgraph_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."llm_models"
    ADD CONSTRAINT "llm_models_pkey" PRIMARY KEY ("provider_name", "model_name");



ALTER TABLE ONLY "public"."llm_providers"
    ADD CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."llm_usage"
    ADD CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_project_id_step_id_key" UNIQUE ("project_id", "step_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pseudonym_dictionaries"
    ADD CONSTRAINT "pseudonym_dictionaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pseudonym_mappings"
    ADD CONSTRAINT "pseudonym_mappings_original_hash_key" UNIQUE ("original_hash");



ALTER TABLE ONLY "public"."pseudonym_mappings"
    ADD CONSTRAINT "pseudonym_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."redaction_audit_log"
    ADD CONSTRAINT "redaction_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."redaction_patterns"
    ADD CONSTRAINT "redaction_patterns_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."redaction_patterns"
    ADD CONSTRAINT "redaction_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_audit_log"
    ADD CONSTRAINT "role_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sensitive_data_vault"
    ADD CONSTRAINT "sensitive_data_vault_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "unique_current_version_per_deliverable" EXCLUDE USING "btree" ("deliverable_id" WITH =) WHERE (("is_current_version" = true));



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "unique_deliverable_per_conversation" UNIQUE ("conversation_id");



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "unique_version_number_per_deliverable" UNIQUE ("deliverable_id", "version_number");



ALTER TABLE ONLY "public"."user_cidafm_commands"
    ADD CONSTRAINT "user_cidafm_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_cidafm_commands"
    ADD CONSTRAINT "user_cidafm_commands_user_id_command_id_key" UNIQUE ("user_id", "command_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_company_companies_industry" ON "public"."companies" USING "btree" ("industry");



CREATE INDEX "idx_company_companies_name" ON "public"."companies" USING "btree" ("name");



CREATE INDEX "idx_company_departments_company" ON "public"."departments" USING "btree" ("company_id");



CREATE INDEX "idx_company_departments_name" ON "public"."departments" USING "btree" ("name");



CREATE INDEX "idx_company_kpi_data_date" ON "public"."kpi_data" USING "btree" ("date_recorded");



CREATE INDEX "idx_company_kpi_data_department" ON "public"."kpi_data" USING "btree" ("department_id");



CREATE INDEX "idx_company_kpi_data_dept_metric_date" ON "public"."kpi_data" USING "btree" ("department_id", "metric_id", "date_recorded");



CREATE INDEX "idx_company_kpi_data_metric" ON "public"."kpi_data" USING "btree" ("metric_id");



CREATE INDEX "idx_company_kpi_goals_department" ON "public"."kpi_goals" USING "btree" ("department_id");



CREATE INDEX "idx_company_kpi_goals_metric" ON "public"."kpi_goals" USING "btree" ("metric_id");



CREATE INDEX "idx_company_kpi_goals_period" ON "public"."kpi_goals" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_company_kpi_metrics_name" ON "public"."kpi_metrics" USING "btree" ("name");



CREATE INDEX "idx_company_kpi_metrics_type" ON "public"."kpi_metrics" USING "btree" ("metric_type");



CREATE INDEX "idx_deliverable_versions_created_by_type" ON "public"."deliverable_versions" USING "btree" ("created_by_type");



CREATE INDEX "idx_deliverable_versions_current" ON "public"."deliverable_versions" USING "btree" ("deliverable_id", "is_current_version");



CREATE INDEX "idx_deliverable_versions_deliverable_id" ON "public"."deliverable_versions" USING "btree" ("deliverable_id");



CREATE INDEX "idx_deliverable_versions_number" ON "public"."deliverable_versions" USING "btree" ("deliverable_id", "version_number");



CREATE INDEX "idx_deliverable_versions_task_id" ON "public"."deliverable_versions" USING "btree" ("task_id");



CREATE INDEX "idx_deliverable_versions_version_number" ON "public"."deliverable_versions" USING "btree" ("deliverable_id", "version_number");



CREATE INDEX "idx_deliverables_agent_name" ON "public"."deliverables" USING "btree" ("agent_name") WHERE ("agent_name" IS NOT NULL);



CREATE INDEX "idx_deliverables_conversation_id" ON "public"."deliverables" USING "btree" ("conversation_id");



CREATE INDEX "idx_deliverables_project_step_id" ON "public"."deliverables" USING "btree" ("project_step_id");



CREATE INDEX "idx_deliverables_standalone" ON "public"."deliverables" USING "btree" ("user_id") WHERE ("conversation_id" IS NULL);



CREATE INDEX "idx_deliverables_task_id" ON "public"."deliverables" USING "btree" ("task_id");



CREATE INDEX "idx_deliverables_type" ON "public"."deliverables" USING "btree" ("deliverable_type");



CREATE INDEX "idx_deliverables_user_id" ON "public"."deliverables" USING "btree" ("user_id");



CREATE INDEX "idx_llm_models_active" ON "public"."llm_models" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_llm_models_local" ON "public"."llm_models" USING "btree" ("is_local") WHERE ("is_local" = true);



CREATE INDEX "idx_llm_models_provider" ON "public"."llm_models" USING "btree" ("provider_name");



CREATE INDEX "idx_llm_usage_provider_model" ON "public"."llm_usage" USING "btree" ("provider", "model");



CREATE INDEX "idx_llm_usage_session" ON "public"."llm_usage" USING "btree" ("session_id");



CREATE INDEX "idx_llm_usage_timestamp" ON "public"."llm_usage" USING "btree" ("request_timestamp");



CREATE INDEX "idx_llm_usage_user_id" ON "public"."llm_usage" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_agent_conversations_active" ON "public"."agent_conversations" USING "btree" ("last_active_at");



CREATE INDEX "idx_orchestrator_agent_conversations_agent" ON "public"."agent_conversations" USING "btree" ("agent_name");



CREATE INDEX "idx_orchestrator_agent_conversations_user" ON "public"."agent_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_cidafm_commands_name" ON "public"."cidafm_commands" USING "btree" ("name");



CREATE INDEX "idx_orchestrator_cidafm_commands_type" ON "public"."cidafm_commands" USING "btree" ("type");



CREATE INDEX "idx_orchestrator_deliverables_conversation" ON "public"."deliverables" USING "btree" ("conversation_id");



CREATE INDEX "idx_orchestrator_deliverables_type" ON "public"."deliverables" USING "btree" ("deliverable_type");



CREATE INDEX "idx_orchestrator_deliverables_user" ON "public"."deliverables" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_human_inputs_created" ON "public"."human_inputs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orchestrator_human_inputs_status" ON "public"."human_inputs" USING "btree" ("status");



CREATE INDEX "idx_orchestrator_human_inputs_task" ON "public"."human_inputs" USING "btree" ("task_id");



CREATE INDEX "idx_orchestrator_human_inputs_timeout" ON "public"."human_inputs" USING "btree" ("timeout_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_orchestrator_human_inputs_user" ON "public"."human_inputs" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_langgraph_states_project" ON "public"."langgraph_states" USING "btree" ("project_id");



CREATE INDEX "idx_orchestrator_langgraph_states_version" ON "public"."langgraph_states" USING "btree" ("state_version");



CREATE INDEX "idx_orchestrator_project_steps_index" ON "public"."project_steps" USING "btree" ("project_id", "step_index");



CREATE INDEX "idx_orchestrator_project_steps_project" ON "public"."project_steps" USING "btree" ("project_id");



CREATE INDEX "idx_orchestrator_project_steps_status" ON "public"."project_steps" USING "btree" ("status");



CREATE INDEX "idx_orchestrator_projects_conversation" ON "public"."projects" USING "btree" ("conversation_id");



CREATE INDEX "idx_orchestrator_projects_parent" ON "public"."projects" USING "btree" ("parent_project_id");



CREATE INDEX "idx_orchestrator_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_orchestrator_projects_user" ON "public"."projects" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_tasks_conversation" ON "public"."tasks" USING "btree" ("agent_conversation_id");



CREATE INDEX "idx_orchestrator_tasks_created" ON "public"."tasks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orchestrator_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_orchestrator_tasks_user" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_user_cidafm_active" ON "public"."user_cidafm_commands" USING "btree" ("is_active");



CREATE INDEX "idx_orchestrator_user_cidafm_user" ON "public"."user_cidafm_commands" USING "btree" ("user_id");



CREATE INDEX "idx_orchestrator_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_orchestrator_users_status" ON "public"."users" USING "btree" ("status");



CREATE INDEX "idx_project_steps_project_id" ON "public"."project_steps" USING "btree" ("project_id");



CREATE INDEX "idx_project_steps_status" ON "public"."project_steps" USING "btree" ("status");



CREATE INDEX "idx_project_steps_step_index" ON "public"."project_steps" USING "btree" ("project_id", "step_index");



CREATE INDEX "idx_pseudonym_dict_category" ON "public"."pseudonym_dictionaries" USING "btree" ("category", "is_active");



CREATE INDEX "idx_pseudonym_dict_locale" ON "public"."pseudonym_dictionaries" USING "btree" ("locale");



CREATE INDEX "idx_pseudonym_dict_type" ON "public"."pseudonym_dictionaries" USING "btree" ("data_type", "is_active");



CREATE INDEX "idx_pseudonym_mappings_context" ON "public"."pseudonym_mappings" USING "btree" ("context");



CREATE INDEX "idx_pseudonym_mappings_expires" ON "public"."pseudonym_mappings" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_pseudonym_mappings_hash" ON "public"."pseudonym_mappings" USING "btree" ("original_hash");



CREATE INDEX "idx_pseudonym_mappings_type" ON "public"."pseudonym_mappings" USING "btree" ("data_type");



CREATE INDEX "idx_redaction_audit_created" ON "public"."redaction_audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_redaction_audit_operation" ON "public"."redaction_audit_log" USING "btree" ("operation_type");



CREATE INDEX "idx_redaction_audit_run" ON "public"."redaction_audit_log" USING "btree" ("run_id");



CREATE INDEX "idx_redaction_audit_session" ON "public"."redaction_audit_log" USING "btree" ("session_id");



CREATE INDEX "idx_redaction_audit_user" ON "public"."redaction_audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_redaction_patterns_active" ON "public"."redaction_patterns" USING "btree" ("is_active", "priority");



CREATE INDEX "idx_redaction_patterns_category" ON "public"."redaction_patterns" USING "btree" ("category");



CREATE INDEX "idx_sensitive_vault_mapping" ON "public"."sensitive_data_vault" USING "btree" ("pseudonym_mapping_id");



CREATE INDEX "idx_sensitive_vault_retention" ON "public"."sensitive_data_vault" USING "btree" ("retention_until");



CREATE OR REPLACE TRIGGER "update_company_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_departments_updated_at" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_kpi_data_updated_at" BEFORE UPDATE ON "public"."kpi_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_kpi_goals_updated_at" BEFORE UPDATE ON "public"."kpi_goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_company_kpi_metrics_updated_at" BEFORE UPDATE ON "public"."kpi_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deliverable_versions_updated_at" BEFORE UPDATE ON "public"."deliverable_versions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_agent_conversations_updated_at" BEFORE UPDATE ON "public"."agent_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_cidafm_commands_updated_at" BEFORE UPDATE ON "public"."cidafm_commands" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_deliverables_updated_at" BEFORE UPDATE ON "public"."deliverables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_human_inputs_updated_at" BEFORE UPDATE ON "public"."human_inputs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_langgraph_states_updated_at" BEFORE UPDATE ON "public"."langgraph_states" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_project_steps_updated_at" BEFORE UPDATE ON "public"."project_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orchestrator_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_steps_updated_at" BEFORE UPDATE ON "public"."project_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_redaction_patterns_updated_at" BEFORE UPDATE ON "public"."redaction_patterns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_project_step_id_fkey" FOREIGN KEY ("project_step_id") REFERENCES "public"."project_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "fk_deliverable_versions_deliverable_id" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "fk_deliverables_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "fk_deliverables_conversation_id" ON "public"."deliverables" IS 'SET NULL allows deliverables to survive conversation deletion for flexible workflows';



ALTER TABLE ONLY "public"."human_inputs"
    ADD CONSTRAINT "human_inputs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."human_inputs"
    ADD CONSTRAINT "human_inputs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_data"
    ADD CONSTRAINT "kpi_data_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_data"
    ADD CONSTRAINT "kpi_data_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."kpi_metrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."kpi_metrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."langgraph_states"
    ADD CONSTRAINT "langgraph_states_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."llm_models"
    ADD CONSTRAINT "llm_models_provider_name_fkey" FOREIGN KEY ("provider_name") REFERENCES "public"."llm_providers"("name") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."redaction_audit_log"
    ADD CONSTRAINT "redaction_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."redaction_patterns"
    ADD CONSTRAINT "redaction_patterns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sensitive_data_vault"
    ADD CONSTRAINT "sensitive_data_vault_pseudonym_mapping_id_fkey" FOREIGN KEY ("pseudonym_mapping_id") REFERENCES "public"."pseudonym_mappings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_agent_conversation_id_fkey" FOREIGN KEY ("agent_conversation_id") REFERENCES "public"."agent_conversations"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_cidafm_commands"
    ADD CONSTRAINT "user_cidafm_commands_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "public"."cidafm_commands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_cidafm_commands"
    ADD CONSTRAINT "user_cidafm_commands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can view own deliverable versions" ON "public"."deliverable_versions" USING (("auth"."uid"() = ( SELECT "d"."user_id"
   FROM "public"."deliverables" "d"
  WHERE ("d"."id" = "deliverable_versions"."deliverable_id"))));



CREATE POLICY "Users can view own project steps" ON "public"."project_steps" USING (("auth"."uid"() = ( SELECT "projects"."user_id"
   FROM "public"."projects"
  WHERE ("projects"."id" = "project_steps"."project_id"))));



CREATE POLICY "audit_log_read_own_or_admin" ON "public"."redaction_audit_log" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."roles" @> '["admin"]'::"jsonb") OR (("users"."roles")::"text" ~~ '%admin%'::"text")))))));



ALTER TABLE "public"."deliverable_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."redaction_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sensitive_data_vault" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vault_access_admin_only" ON "public"."sensitive_data_vault" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."roles" @> '["admin"]'::"jsonb") OR (("users"."roles")::"text" ~~ '%admin%'::"text"))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."calculate_sanitization_score"("p_pii_detected" boolean, "p_sanitization_level" character varying, "p_redactions_applied" integer, "p_pseudonyms_used" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_sanitization_score"("p_pii_detected" boolean, "p_sanitization_level" character varying, "p_redactions_applied" integer, "p_pseudonyms_used" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_sanitization_score"("p_pii_detected" boolean, "p_sanitization_level" character varying, "p_redactions_applied" integer, "p_pseudonyms_used" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_deliverable_version"("deliverable_uuid" "uuid", "version_content" "text", "version_format" character varying, "creation_type" character varying, "version_task_id" "uuid", "version_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_deliverable_version"("deliverable_uuid" "uuid", "version_content" "text", "version_format" character varying, "creation_type" character varying, "version_task_id" "uuid", "version_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_deliverable_version"("deliverable_uuid" "uuid", "version_content" "text", "version_format" character varying, "creation_type" character varying, "version_task_id" "uuid", "version_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_compliance_status"("p_llm_usage_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_compliance_status"("p_llm_usage_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_compliance_status"("p_llm_usage_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_deliverable_version"("deliverable_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_deliverable_version"("deliverable_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_deliverable_version"("deliverable_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_usage_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_usage_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_usage_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_llm_usage_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_llm_usage_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_llm_usage_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."agent_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."cidafm_commands" TO "anon";
GRANT ALL ON TABLE "public"."cidafm_commands" TO "authenticated";
GRANT ALL ON TABLE "public"."cidafm_commands" TO "service_role";



GRANT ALL ON TABLE "public"."deliverable_versions" TO "anon";
GRANT ALL ON TABLE "public"."deliverable_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverable_versions" TO "service_role";



GRANT ALL ON TABLE "public"."deliverables" TO "anon";
GRANT ALL ON TABLE "public"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."human_inputs" TO "anon";
GRANT ALL ON TABLE "public"."human_inputs" TO "authenticated";
GRANT ALL ON TABLE "public"."human_inputs" TO "service_role";



GRANT ALL ON TABLE "public"."langgraph_states" TO "anon";
GRANT ALL ON TABLE "public"."langgraph_states" TO "authenticated";
GRANT ALL ON TABLE "public"."langgraph_states" TO "service_role";



GRANT ALL ON TABLE "public"."llm_models" TO "anon";
GRANT ALL ON TABLE "public"."llm_models" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_models" TO "service_role";



GRANT ALL ON TABLE "public"."llm_models_backup" TO "anon";
GRANT ALL ON TABLE "public"."llm_models_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_models_backup" TO "service_role";



GRANT ALL ON TABLE "public"."llm_providers" TO "anon";
GRANT ALL ON TABLE "public"."llm_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_providers" TO "service_role";



GRANT ALL ON TABLE "public"."llm_providers_backup" TO "anon";
GRANT ALL ON TABLE "public"."llm_providers_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_providers_backup" TO "service_role";



GRANT ALL ON TABLE "public"."llm_usage" TO "anon";
GRANT ALL ON TABLE "public"."llm_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_usage" TO "service_role";



GRANT ALL ON TABLE "public"."llm_usage_backup" TO "anon";
GRANT ALL ON TABLE "public"."llm_usage_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_usage_backup" TO "service_role";



GRANT ALL ON TABLE "public"."project_steps" TO "anon";
GRANT ALL ON TABLE "public"."project_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."project_steps" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."pseudonym_dictionaries" TO "anon";
GRANT ALL ON TABLE "public"."pseudonym_dictionaries" TO "authenticated";
GRANT ALL ON TABLE "public"."pseudonym_dictionaries" TO "service_role";



GRANT ALL ON TABLE "public"."pseudonym_mappings" TO "anon";
GRANT ALL ON TABLE "public"."pseudonym_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."pseudonym_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."redaction_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."redaction_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."redaction_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."redaction_patterns" TO "anon";
GRANT ALL ON TABLE "public"."redaction_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."redaction_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."role_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."role_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."role_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."sensitive_data_vault" TO "anon";
GRANT ALL ON TABLE "public"."sensitive_data_vault" TO "authenticated";
GRANT ALL ON TABLE "public"."sensitive_data_vault" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_cidafm_commands" TO "anon";
GRANT ALL ON TABLE "public"."user_cidafm_commands" TO "authenticated";
GRANT ALL ON TABLE "public"."user_cidafm_commands" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









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






























RESET ALL;

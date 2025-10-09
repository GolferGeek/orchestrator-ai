
\restrict 9XVBzzLBDH9aCJXJQQZXALPYAfMLxtO6PWYildlvMVZSxD6SBI3X7QAuJUipSZo


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






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_completion_percentage"("requirements" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    total_fields INTEGER := 12;  -- Total required fields
    completed_fields INTEGER := 0;
    field_name TEXT;
BEGIN
    -- Count non-null, non-empty required fields
    FOR field_name IN SELECT * FROM jsonb_object_keys(requirements)
    LOOP
        IF requirements ->> field_name IS NOT NULL 
           AND LENGTH(TRIM(requirements ->> field_name)) > 0 THEN
            completed_fields := completed_fields + 1;
        END IF;
    END LOOP;
    
    RETURN (completed_fields * 100 / total_fields);
END;
$$;


ALTER FUNCTION "public"."calculate_completion_percentage"("requirements" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_abandoned_conversations"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete conversations abandoned for more than 7 days
    DELETE FROM agent_creation_conversations
    WHERE completion_status = 'in_progress'
      AND last_activity_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_abandoned_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_agent_action"("p_action" character varying, "p_agent_id" "uuid", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_previous_state" "jsonb" DEFAULT NULL::"jsonb", "p_new_state" "jsonb" DEFAULT NULL::"jsonb", "p_success" boolean DEFAULT true, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO agent_creation_logs (
        action, agent_configuration_id, performed_by, details,
        previous_state, new_state, success, error_message
    ) VALUES (
        p_action, p_agent_id, auth.uid(), p_details,
        p_previous_state, p_new_state, p_success, p_error_message
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;


ALTER FUNCTION "public"."log_agent_action"("p_action" character varying, "p_agent_id" "uuid", "p_details" "jsonb", "p_previous_state" "jsonb", "p_new_state" "jsonb", "p_success" boolean, "p_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_agent_action"("p_action" character varying, "p_agent_id" "uuid", "p_details" "jsonb", "p_previous_state" "jsonb", "p_new_state" "jsonb", "p_success" boolean, "p_error_message" "text") IS 'Helper function to create audit log entries';



CREATE OR REPLACE FUNCTION "public"."update_agent_configurations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_agent_configurations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_agent_skills_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_agent_skills_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_agent_usage_analytics"("p_agent_id" "uuid", "p_conversation_increment" integer DEFAULT 0, "p_message_increment" integer DEFAULT 0, "p_response_time_ms" integer DEFAULT NULL::integer, "p_error_increment" integer DEFAULT 0, "p_unique_user_increment" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO agent_usage_analytics (
        agent_configuration_id, agent_id, date_period,
        conversation_count, message_count, error_count, unique_users
    ) VALUES (
        p_agent_id, 
        (SELECT agent_id FROM agent_configurations WHERE id = p_agent_id),
        CURRENT_DATE,
        p_conversation_increment, p_message_increment, p_error_increment, p_unique_user_increment
    )
    ON CONFLICT (agent_configuration_id, date_period) 
    DO UPDATE SET
        conversation_count = agent_usage_analytics.conversation_count + p_conversation_increment,
        message_count = agent_usage_analytics.message_count + p_message_increment,
        error_count = agent_usage_analytics.error_count + p_error_increment,
        unique_users = agent_usage_analytics.unique_users + p_unique_user_increment,
        avg_response_time_ms = CASE 
            WHEN p_response_time_ms IS NOT NULL THEN
                COALESCE(
                    (agent_usage_analytics.avg_response_time_ms + p_response_time_ms) / 2,
                    p_response_time_ms
                )
            ELSE agent_usage_analytics.avg_response_time_ms
        END,
        last_updated = NOW();
END;
$$;


ALTER FUNCTION "public"."update_agent_usage_analytics"("p_agent_id" "uuid", "p_conversation_increment" integer, "p_message_increment" integer, "p_response_time_ms" integer, "p_error_increment" integer, "p_unique_user_increment" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_agent_usage_analytics"("p_agent_id" "uuid", "p_conversation_increment" integer, "p_message_increment" integer, "p_response_time_ms" integer, "p_error_increment" integer, "p_unique_user_increment" integer) IS 'Helper function to update daily usage stats';



CREATE OR REPLACE FUNCTION "public"."update_completion_percentage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.completion_percentage = calculate_completion_percentage(NEW.requirements_gathered);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_completion_percentage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_creation_metrics"("p_success" boolean, "p_creation_time_seconds" integer DEFAULT NULL::integer, "p_questions_answered" integer DEFAULT NULL::integer, "p_department" character varying DEFAULT NULL::character varying) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    current_hour INTEGER;
    dept_breakdown JSONB;
BEGIN
    current_hour := EXTRACT(hour FROM NOW());
    
    -- Get current department breakdown or initialize
    SELECT department_breakdown INTO dept_breakdown
    FROM agent_creation_metrics
    WHERE date_period = CURRENT_DATE AND hour_period = current_hour;
    
    IF dept_breakdown IS NULL THEN
        dept_breakdown := '{}';
    END IF;
    
    -- Update department count
    IF p_department IS NOT NULL THEN
        dept_breakdown := jsonb_set(
            dept_breakdown,
            ARRAY[p_department],
            to_jsonb(COALESCE((dept_breakdown ->> p_department)::INTEGER, 0) + 1)
        );
    END IF;
    
    INSERT INTO agent_creation_metrics (
        date_period, hour_period, total_attempts,
        successful_creations, failed_creations,
        avg_creation_time_seconds, avg_questions_to_completion,
        department_breakdown
    ) VALUES (
        CURRENT_DATE, current_hour, 1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        p_creation_time_seconds, p_questions_answered,
        dept_breakdown
    )
    ON CONFLICT (date_period, hour_period)
    DO UPDATE SET
        total_attempts = agent_creation_metrics.total_attempts + 1,
        successful_creations = agent_creation_metrics.successful_creations + 
            CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_creations = agent_creation_metrics.failed_creations + 
            CASE WHEN p_success THEN 0 ELSE 1 END,
        avg_creation_time_seconds = CASE 
            WHEN p_creation_time_seconds IS NOT NULL THEN
                COALESCE(
                    (agent_creation_metrics.avg_creation_time_seconds + p_creation_time_seconds) / 2,
                    p_creation_time_seconds
                )
            ELSE agent_creation_metrics.avg_creation_time_seconds
        END,
        avg_questions_to_completion = CASE 
            WHEN p_questions_answered IS NOT NULL THEN
                COALESCE(
                    (agent_creation_metrics.avg_questions_to_completion + p_questions_answered) / 2.0,
                    p_questions_answered::DECIMAL
                )
            ELSE agent_creation_metrics.avg_questions_to_completion
        END,
        department_breakdown = dept_breakdown,
        last_updated = NOW();
END;
$$;


ALTER FUNCTION "public"."update_creation_metrics"("p_success" boolean, "p_creation_time_seconds" integer, "p_questions_answered" integer, "p_department" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_creation_metrics"("p_success" boolean, "p_creation_time_seconds" integer, "p_questions_answered" integer, "p_department" character varying) IS 'Helper function to update system creation metrics';



CREATE OR REPLACE FUNCTION "public"."validate_skill_examples"("examples" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    example_text TEXT;
    example_value JSONB;
BEGIN
    -- Check each example in the array
    FOR example_value IN SELECT jsonb_array_elements(examples)
    LOOP
        example_text := example_value #>> '{}';
        
        -- Ensure example is not empty or too short
        IF LENGTH(TRIM(example_text)) < 5 THEN
            RETURN FALSE;
        END IF;
        
        -- Ensure example is a reasonable length (not too long)
        IF LENGTH(example_text) > 500 THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."validate_skill_examples"("examples" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_configurations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" character varying(100) NOT NULL,
    "display_name" character varying(200) NOT NULL,
    "agent_type" character varying(50) NOT NULL,
    "department" character varying(100) NOT NULL,
    "reports_to" character varying(100),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "primary_purpose" "text" NOT NULL,
    "capabilities" "jsonb" NOT NULL,
    "expertise_areas" "jsonb" NOT NULL,
    "responsibilities" "jsonb" NOT NULL,
    "limitations" "jsonb" NOT NULL,
    "communication_style" character varying(100),
    "core_identity" "text",
    "yaml_config" "text" NOT NULL,
    "context_content" "text" NOT NULL,
    "service_content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "last_accessed_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    CONSTRAINT "check_agent_id_format" CHECK ((("agent_id")::"text" ~ '^[a-z][a-z0-9_]*$'::"text")),
    CONSTRAINT "check_agent_type" CHECK ((("agent_type")::"text" = ANY ((ARRAY['context'::character varying, 'api'::character varying, 'function'::character varying])::"text"[]))),
    CONSTRAINT "check_communication_style" CHECK ((("communication_style")::"text" = ANY ((ARRAY['professional'::character varying, 'casual'::character varying, 'technical'::character varying, 'conversational'::character varying, 'formal'::character varying, 'creative'::character varying])::"text"[]))),
    CONSTRAINT "check_department" CHECK ((("department")::"text" = ANY ((ARRAY['marketing'::character varying, 'engineering'::character varying, 'operations'::character varying, 'finance'::character varying, 'hr'::character varying, 'sales'::character varying, 'research'::character varying, 'product'::character varying, 'specialists'::character varying])::"text"[]))),
    CONSTRAINT "check_display_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "display_name")) > 0)),
    CONSTRAINT "check_primary_purpose_length" CHECK (("length"(TRIM(BOTH FROM "primary_purpose")) >= 20)),
    CONSTRAINT "check_status" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying, 'draft'::character varying])::"text"[])))
);


ALTER TABLE "public"."agent_configurations" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_configurations" IS 'Stores dynamically created agent configurations with generated content';



COMMENT ON COLUMN "public"."agent_configurations"."agent_id" IS 'Unique snake_case identifier for routing (e.g., social_media_writer)';



COMMENT ON COLUMN "public"."agent_configurations"."yaml_config" IS 'Generated YAML configuration content';



COMMENT ON COLUMN "public"."agent_configurations"."context_content" IS 'Generated context.md system prompt content';



COMMENT ON COLUMN "public"."agent_configurations"."service_content" IS 'Generated service.ts TypeScript content';



CREATE TABLE IF NOT EXISTS "public"."agent_creation_conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" character varying(100) NOT NULL,
    "user_id" "uuid",
    "agent_configuration_id" "uuid",
    "conversation_data" "jsonb" NOT NULL,
    "requirements_gathered" "jsonb" DEFAULT '{}'::"jsonb",
    "current_phase" character varying(50) DEFAULT 'identity'::character varying,
    "current_question" integer DEFAULT 1,
    "completion_status" character varying(50) DEFAULT 'in_progress'::character varying,
    "completion_percentage" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "user_agent" "text",
    "ip_address" "inet",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "check_completion_percentage" CHECK ((("completion_percentage" >= 0) AND ("completion_percentage" <= 100))),
    CONSTRAINT "check_completion_status" CHECK ((("completion_status")::"text" = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'abandoned'::character varying, 'failed'::character varying])::"text"[]))),
    CONSTRAINT "check_current_phase" CHECK ((("current_phase")::"text" = ANY ((ARRAY['identity'::character varying, 'hierarchy'::character varying, 'purpose'::character varying, 'skills'::character varying, 'style'::character varying, 'technical'::character varying, 'complete'::character varying])::"text"[]))),
    CONSTRAINT "check_current_question_range" CHECK ((("current_question" >= 1) AND ("current_question" <= 12)))
);


ALTER TABLE "public"."agent_creation_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_creation_conversations" IS 'Tracks agent creation conversation state for resuming interrupted sessions';



COMMENT ON COLUMN "public"."agent_creation_conversations"."requirements_gathered" IS 'JSON object tracking completion of 12 required fields';



COMMENT ON COLUMN "public"."agent_creation_conversations"."current_phase" IS 'Current phase in structured conversation flow';



CREATE TABLE IF NOT EXISTS "public"."agent_creation_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "question_number" integer,
    "field_name" character varying(100),
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "user_input" "text",
    "ai_response" "text",
    "validation_result" "jsonb",
    CONSTRAINT "check_event_type" CHECK ((("event_type")::"text" = ANY ((ARRAY['conversation_started'::character varying, 'question_asked'::character varying, 'answer_provided'::character varying, 'validation_passed'::character varying, 'validation_failed'::character varying, 'phase_completed'::character varying, 'agent_created'::character varying, 'conversation_completed'::character varying, 'conversation_abandoned'::character varying])::"text"[])))
);


ALTER TABLE "public"."agent_creation_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_creation_events" IS 'Detailed log of events during agent creation conversations';



COMMENT ON COLUMN "public"."agent_creation_events"."event_data" IS 'Event-specific data like validation results, user inputs, etc.';



CREATE TABLE IF NOT EXISTS "public"."agent_creation_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action" character varying(100) NOT NULL,
    "agent_configuration_id" "uuid",
    "performed_by" "uuid",
    "performed_at" timestamp with time zone DEFAULT "now"(),
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "previous_state" "jsonb",
    "new_state" "jsonb",
    "success" boolean DEFAULT true,
    "error_message" "text",
    CONSTRAINT "check_action_type" CHECK ((("action")::"text" = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'activated'::character varying, 'deactivated'::character varying, 'deleted'::character varying, 'accessed'::character varying, 'conversation_started'::character varying, 'error_occurred'::character varying])::"text"[])))
);


ALTER TABLE "public"."agent_creation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_creation_logs" IS 'Audit trail for all agent-related actions';



CREATE TABLE IF NOT EXISTS "public"."agent_creation_metrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "date_period" "date" NOT NULL,
    "hour_period" integer,
    "total_attempts" integer DEFAULT 0,
    "successful_creations" integer DEFAULT 0,
    "failed_creations" integer DEFAULT 0,
    "abandoned_conversations" integer DEFAULT 0,
    "avg_creation_time_seconds" integer,
    "avg_questions_to_completion" numeric(4,2),
    "most_failed_question" integer,
    "agents_with_quality_issues" integer DEFAULT 0,
    "avg_capabilities_count" numeric(4,2),
    "avg_skills_count" numeric(4,2),
    "department_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_hour_period" CHECK ((("hour_period" >= 0) AND ("hour_period" <= 23)))
);


ALTER TABLE "public"."agent_creation_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_creation_metrics" IS 'System-wide metrics for agent creation process';



CREATE TABLE IF NOT EXISTS "public"."agent_skills" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_configuration_id" "uuid" NOT NULL,
    "skill_id" character varying(100) NOT NULL,
    "skill_name" character varying(200) NOT NULL,
    "description" "text" NOT NULL,
    "examples" "jsonb" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "input_modes" "jsonb" DEFAULT '["text/plain", "application/json"]'::"jsonb",
    "output_modes" "jsonb" DEFAULT '["text/plain", "application/json"]'::"jsonb",
    "skill_order" integer DEFAULT 0,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_examples_not_empty" CHECK (("jsonb_array_length"("examples") > 0)),
    CONSTRAINT "check_examples_quality" CHECK ("public"."validate_skill_examples"("examples")),
    CONSTRAINT "check_skill_description_length" CHECK (("length"(TRIM(BOTH FROM "description")) >= 10)),
    CONSTRAINT "check_skill_id_format" CHECK ((("skill_id")::"text" ~ '^[a-z][a-z0-9_]*$'::"text")),
    CONSTRAINT "check_skill_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "skill_name")) > 0))
);


ALTER TABLE "public"."agent_skills" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_skills" IS 'Stores skills and user-provided examples for each agent';



COMMENT ON COLUMN "public"."agent_skills"."skill_id" IS 'Snake_case identifier unique per agent';



COMMENT ON COLUMN "public"."agent_skills"."examples" IS 'Array of concrete example queries from user domain';



COMMENT ON COLUMN "public"."agent_skills"."is_primary" IS 'Whether this is the main/primary skill for the agent';



CREATE TABLE IF NOT EXISTS "public"."agent_usage_analytics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_configuration_id" "uuid" NOT NULL,
    "agent_id" character varying(100) NOT NULL,
    "conversation_count" integer DEFAULT 0,
    "message_count" integer DEFAULT 0,
    "avg_response_time_ms" integer,
    "error_count" integer DEFAULT 0,
    "unique_users" integer DEFAULT 0,
    "returning_users" integer DEFAULT 0,
    "satisfaction_rating" numeric(3,2),
    "date_period" "date" NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "check_satisfaction_rating" CHECK ((("satisfaction_rating" >= 0.0) AND ("satisfaction_rating" <= 5.0)))
);


ALTER TABLE "public"."agent_usage_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_usage_analytics" IS 'Daily usage analytics for each agent';



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "industry" character varying(100),
    "founded_year" integer,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "agent_name" character varying(255),
    "agent_type" character varying(100),
    "started_at" timestamp with time zone,
    "last_active_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


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
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliverable_versions_created_by_type_check" CHECK ((("created_by_type")::"text" = ANY ((ARRAY['ai_response'::character varying, 'manual_edit'::character varying, 'ai_enhancement'::character varying, 'user_request'::character varying, 'conversation_task'::character varying, 'conversation_merge'::character varying])::"text"[])))
);


ALTER TABLE "public"."deliverable_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "uuid",
    "title" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."deliverables" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."llm_models" (
    "model_name" "text" NOT NULL,
    "provider_name" "text" NOT NULL,
    "display_name" "text",
    "model_type" "text" DEFAULT 'text-generation'::"text",
    "context_window" integer DEFAULT 4096,
    "max_output_tokens" integer DEFAULT 2048,
    "model_tier" "text",
    "is_local" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."llm_models" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."llm_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "run_id" "text",
    "user_id" "uuid",
    "conversation_id" "uuid",
    "provider_name" "text",
    "model_name" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "total_cost" numeric,
    "duration_ms" integer,
    "status" "text" DEFAULT 'completed'::"text",
    "pii_detected" boolean DEFAULT false,
    "pii_types" "jsonb" DEFAULT '[]'::"jsonb",
    "pseudonyms_used" integer DEFAULT 0,
    "pseudonym_types" "jsonb" DEFAULT '[]'::"jsonb",
    "sanitization_level" "text" DEFAULT 'none'::"text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."llm_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pseudonym_dictionaries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "original_value" "text" NOT NULL,
    "pseudonym" "text" NOT NULL,
    "data_type" character varying(100) NOT NULL,
    "category" character varying(100),
    "frequency_weight" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."pseudonym_dictionaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."redaction_patterns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "pattern_regex" "text" NOT NULL,
    "replacement" "text" NOT NULL,
    "description" "text",
    "category" character varying(100) DEFAULT 'pii_builtin'::character varying,
    "priority" integer DEFAULT 50,
    "is_active" boolean DEFAULT true,
    "severity" character varying(50),
    "data_type" character varying(50),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."redaction_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "uuid",
    "method" character varying(255),
    "prompt" "text",
    "response" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "display_name" character varying(255),
    "role" character varying(50),
    "roles" "jsonb" DEFAULT '["user"]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_configurations"
    ADD CONSTRAINT "agent_configurations_agent_id_key" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."agent_configurations"
    ADD CONSTRAINT "agent_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_creation_conversations"
    ADD CONSTRAINT "agent_creation_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_creation_events"
    ADD CONSTRAINT "agent_creation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_creation_logs"
    ADD CONSTRAINT "agent_creation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_creation_metrics"
    ADD CONSTRAINT "agent_creation_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_skills"
    ADD CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_usage_analytics"
    ADD CONSTRAINT "agent_usage_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_data"
    ADD CONSTRAINT "kpi_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_metrics"
    ADD CONSTRAINT "kpi_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."llm_models"
    ADD CONSTRAINT "llm_models_pkey" PRIMARY KEY ("provider_name", "model_name");



ALTER TABLE ONLY "public"."llm_providers"
    ADD CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."llm_usage"
    ADD CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."llm_usage"
    ADD CONSTRAINT "llm_usage_run_id_key" UNIQUE ("run_id");



ALTER TABLE ONLY "public"."pseudonym_dictionaries"
    ADD CONSTRAINT "pseudonym_dictionaries_original_value_key" UNIQUE ("original_value");



ALTER TABLE ONLY "public"."pseudonym_dictionaries"
    ADD CONSTRAINT "pseudonym_dictionaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."redaction_patterns"
    ADD CONSTRAINT "redaction_patterns_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."redaction_patterns"
    ADD CONSTRAINT "redaction_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_usage_analytics"
    ADD CONSTRAINT "unique_agent_date_analytics" UNIQUE ("agent_configuration_id", "date_period");



ALTER TABLE ONLY "public"."agent_creation_metrics"
    ADD CONSTRAINT "unique_date_hour_metrics" UNIQUE ("date_period", "hour_period");



ALTER TABLE ONLY "public"."agent_skills"
    ADD CONSTRAINT "unique_skill_id_per_agent" UNIQUE ("agent_configuration_id", "skill_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_agent_configurations_agent_id" ON "public"."agent_configurations" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_configurations_created_at" ON "public"."agent_configurations" USING "btree" ("created_at");



CREATE INDEX "idx_agent_configurations_created_by" ON "public"."agent_configurations" USING "btree" ("created_by");



CREATE INDEX "idx_agent_configurations_department" ON "public"."agent_configurations" USING "btree" ("department");



CREATE INDEX "idx_agent_configurations_status" ON "public"."agent_configurations" USING "btree" ("status");



CREATE INDEX "idx_agent_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_agent_skills_agent_config" ON "public"."agent_skills" USING "btree" ("agent_configuration_id");



CREATE INDEX "idx_agent_skills_is_primary" ON "public"."agent_skills" USING "btree" ("is_primary");



CREATE INDEX "idx_agent_skills_skill_id" ON "public"."agent_skills" USING "btree" ("skill_id");



CREATE INDEX "idx_agent_skills_skill_order" ON "public"."agent_skills" USING "btree" ("skill_order");



CREATE INDEX "idx_conversations_agent_id" ON "public"."agent_creation_conversations" USING "btree" ("agent_configuration_id");



CREATE INDEX "idx_conversations_last_activity" ON "public"."agent_creation_conversations" USING "btree" ("last_activity_at");



CREATE INDEX "idx_conversations_session_id" ON "public"."agent_creation_conversations" USING "btree" ("session_id");



CREATE INDEX "idx_conversations_status" ON "public"."agent_creation_conversations" USING "btree" ("completion_status");



CREATE INDEX "idx_conversations_user_id" ON "public"."agent_creation_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_creation_logs_action" ON "public"."agent_creation_logs" USING "btree" ("action");



CREATE INDEX "idx_creation_logs_agent_id" ON "public"."agent_creation_logs" USING "btree" ("agent_configuration_id");



CREATE INDEX "idx_creation_logs_performed_at" ON "public"."agent_creation_logs" USING "btree" ("performed_at");



CREATE INDEX "idx_creation_logs_performed_by" ON "public"."agent_creation_logs" USING "btree" ("performed_by");



CREATE INDEX "idx_creation_logs_success" ON "public"."agent_creation_logs" USING "btree" ("success");



CREATE INDEX "idx_creation_metrics_date" ON "public"."agent_creation_metrics" USING "btree" ("date_period");



CREATE INDEX "idx_creation_metrics_hour" ON "public"."agent_creation_metrics" USING "btree" ("hour_period");



CREATE INDEX "idx_events_conversation_id" ON "public"."agent_creation_events" USING "btree" ("conversation_id");



CREATE INDEX "idx_events_event_type" ON "public"."agent_creation_events" USING "btree" ("event_type");



CREATE INDEX "idx_events_question_number" ON "public"."agent_creation_events" USING "btree" ("question_number");



CREATE INDEX "idx_events_timestamp" ON "public"."agent_creation_events" USING "btree" ("timestamp");



CREATE INDEX "idx_llm_usage_created_at" ON "public"."llm_usage" USING "btree" ("created_at");



CREATE INDEX "idx_pseudonym_dictionaries_original_value" ON "public"."pseudonym_dictionaries" USING "btree" ("original_value");



CREATE INDEX "idx_redaction_patterns_active" ON "public"."redaction_patterns" USING "btree" ("is_active", "priority");



CREATE INDEX "idx_tasks_conversation_id" ON "public"."tasks" USING "btree" ("conversation_id");



CREATE INDEX "idx_usage_analytics_agent_id" ON "public"."agent_usage_analytics" USING "btree" ("agent_configuration_id");



CREATE INDEX "idx_usage_analytics_agent_lookup" ON "public"."agent_usage_analytics" USING "btree" ("agent_id");



CREATE INDEX "idx_usage_analytics_date" ON "public"."agent_usage_analytics" USING "btree" ("date_period");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "trigger_agent_configurations_updated_at" BEFORE UPDATE ON "public"."agent_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_agent_configurations_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_agent_skills_updated_at" BEFORE UPDATE ON "public"."agent_skills" FOR EACH ROW EXECUTE FUNCTION "public"."update_agent_skills_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_conversations_updated_at" BEFORE UPDATE ON "public"."agent_creation_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_timestamps"();



CREATE OR REPLACE TRIGGER "trigger_update_completion_percentage" BEFORE UPDATE ON "public"."agent_creation_conversations" FOR EACH ROW WHEN (("old"."requirements_gathered" IS DISTINCT FROM "new"."requirements_gathered")) EXECUTE FUNCTION "public"."update_completion_percentage"();



ALTER TABLE ONLY "public"."agent_configurations"
    ADD CONSTRAINT "agent_configurations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "agent_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."agent_creation_conversations"
    ADD CONSTRAINT "agent_creation_conversations_agent_configuration_id_fkey" FOREIGN KEY ("agent_configuration_id") REFERENCES "public"."agent_configurations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_creation_conversations"
    ADD CONSTRAINT "agent_creation_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_creation_events"
    ADD CONSTRAINT "agent_creation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_creation_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_creation_logs"
    ADD CONSTRAINT "agent_creation_logs_agent_configuration_id_fkey" FOREIGN KEY ("agent_configuration_id") REFERENCES "public"."agent_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_creation_logs"
    ADD CONSTRAINT "agent_creation_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_skills"
    ADD CONSTRAINT "agent_skills_agent_configuration_id_fkey" FOREIGN KEY ("agent_configuration_id") REFERENCES "public"."agent_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_usage_analytics"
    ADD CONSTRAINT "agent_usage_analytics_agent_configuration_id_fkey" FOREIGN KEY ("agent_configuration_id") REFERENCES "public"."agent_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_data"
    ADD CONSTRAINT "kpi_data_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_data"
    ADD CONSTRAINT "kpi_data_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."kpi_metrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."kpi_metrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."llm_models"
    ADD CONSTRAINT "llm_models_provider_name_fkey" FOREIGN KEY ("provider_name") REFERENCES "public"."llm_providers"("name") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."llm_usage"
    ADD CONSTRAINT "llm_usage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



CREATE POLICY "Authenticated users can view creation metrics" ON "public"."agent_creation_metrics" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can create agents" ON "public"."agent_configurations" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can modify own agents" ON "public"."agent_configurations" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can modify skills for own agents" ON "public"."agent_skills" USING ((EXISTS ( SELECT 1
   FROM "public"."agent_configurations" "ac"
  WHERE (("ac"."id" = "agent_skills"."agent_configuration_id") AND ("ac"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users can view active agents" ON "public"."agent_configurations" FOR SELECT USING ((("status")::"text" = 'active'::"text"));



CREATE POLICY "Users can view analytics for own agents" ON "public"."agent_usage_analytics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agent_configurations" "ac"
  WHERE (("ac"."id" = "agent_usage_analytics"."agent_configuration_id") AND ("ac"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users can view logs for own agents" ON "public"."agent_creation_logs" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."agent_configurations" "ac"
  WHERE (("ac"."id" = "agent_creation_logs"."agent_configuration_id") AND ("ac"."created_by" = "auth"."uid"())))) OR ("performed_by" = "auth"."uid"())));



CREATE POLICY "Users can view own conversation events" ON "public"."agent_creation_events" USING ((EXISTS ( SELECT 1
   FROM "public"."agent_creation_conversations" "c"
  WHERE (("c"."id" = "agent_creation_events"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own conversations" ON "public"."agent_creation_conversations" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view skills for active agents" ON "public"."agent_skills" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agent_configurations" "ac"
  WHERE (("ac"."id" = "agent_skills"."agent_configuration_id") AND (("ac"."status")::"text" = 'active'::"text")))));



ALTER TABLE "public"."agent_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_creation_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_creation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_creation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_creation_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_usage_analytics" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."calculate_completion_percentage"("requirements" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_completion_percentage"("requirements" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_completion_percentage"("requirements" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_abandoned_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_abandoned_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_abandoned_conversations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_agent_action"("p_action" character varying, "p_agent_id" "uuid", "p_details" "jsonb", "p_previous_state" "jsonb", "p_new_state" "jsonb", "p_success" boolean, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_agent_action"("p_action" character varying, "p_agent_id" "uuid", "p_details" "jsonb", "p_previous_state" "jsonb", "p_new_state" "jsonb", "p_success" boolean, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_agent_action"("p_action" character varying, "p_agent_id" "uuid", "p_details" "jsonb", "p_previous_state" "jsonb", "p_new_state" "jsonb", "p_success" boolean, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_agent_configurations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_agent_configurations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_agent_configurations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_agent_skills_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_agent_skills_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_agent_skills_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_agent_usage_analytics"("p_agent_id" "uuid", "p_conversation_increment" integer, "p_message_increment" integer, "p_response_time_ms" integer, "p_error_increment" integer, "p_unique_user_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_agent_usage_analytics"("p_agent_id" "uuid", "p_conversation_increment" integer, "p_message_increment" integer, "p_response_time_ms" integer, "p_error_increment" integer, "p_unique_user_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_agent_usage_analytics"("p_agent_id" "uuid", "p_conversation_increment" integer, "p_message_increment" integer, "p_response_time_ms" integer, "p_error_increment" integer, "p_unique_user_increment" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_completion_percentage"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_completion_percentage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_completion_percentage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_creation_metrics"("p_success" boolean, "p_creation_time_seconds" integer, "p_questions_answered" integer, "p_department" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."update_creation_metrics"("p_success" boolean, "p_creation_time_seconds" integer, "p_questions_answered" integer, "p_department" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_creation_metrics"("p_success" boolean, "p_creation_time_seconds" integer, "p_questions_answered" integer, "p_department" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_skill_examples"("examples" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_skill_examples"("examples" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_skill_examples"("examples" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."agent_configurations" TO "anon";
GRANT ALL ON TABLE "public"."agent_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."agent_creation_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_creation_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_creation_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."agent_creation_events" TO "anon";
GRANT ALL ON TABLE "public"."agent_creation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_creation_events" TO "service_role";



GRANT ALL ON TABLE "public"."agent_creation_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_creation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_creation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_creation_metrics" TO "anon";
GRANT ALL ON TABLE "public"."agent_creation_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_creation_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."agent_skills" TO "anon";
GRANT ALL ON TABLE "public"."agent_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_skills" TO "service_role";



GRANT ALL ON TABLE "public"."agent_usage_analytics" TO "anon";
GRANT ALL ON TABLE "public"."agent_usage_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_usage_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."deliverable_versions" TO "anon";
GRANT ALL ON TABLE "public"."deliverable_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverable_versions" TO "service_role";



GRANT ALL ON TABLE "public"."deliverables" TO "anon";
GRANT ALL ON TABLE "public"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_data" TO "anon";
GRANT ALL ON TABLE "public"."kpi_data" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_data" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_goals" TO "anon";
GRANT ALL ON TABLE "public"."kpi_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_goals" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_metrics" TO "anon";
GRANT ALL ON TABLE "public"."kpi_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."llm_models" TO "anon";
GRANT ALL ON TABLE "public"."llm_models" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_models" TO "service_role";



GRANT ALL ON TABLE "public"."llm_providers" TO "anon";
GRANT ALL ON TABLE "public"."llm_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_providers" TO "service_role";



GRANT ALL ON TABLE "public"."llm_usage" TO "anon";
GRANT ALL ON TABLE "public"."llm_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."llm_usage" TO "service_role";



GRANT ALL ON TABLE "public"."pseudonym_dictionaries" TO "anon";
GRANT ALL ON TABLE "public"."pseudonym_dictionaries" TO "authenticated";
GRANT ALL ON TABLE "public"."pseudonym_dictionaries" TO "service_role";



GRANT ALL ON TABLE "public"."redaction_patterns" TO "anon";
GRANT ALL ON TABLE "public"."redaction_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."redaction_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



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






























\unrestrict 9XVBzzLBDH9aCJXJQQZXALPYAfMLxtO6PWYildlvMVZSxD6SBI3X7QAuJUipSZo

RESET ALL;

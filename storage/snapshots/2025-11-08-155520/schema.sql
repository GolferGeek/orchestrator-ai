-- Database Snapshot
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Schemas: public, n8n, company, observability

-- Cleanup existing schemas (WARNING: This will delete all data!)
DROP SCHEMA IF EXISTS observability CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
-- Note: public schema is not dropped as it's required by PostgreSQL

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS n8n;
CREATE SCHEMA IF NOT EXISTS company;
CREATE SCHEMA IF NOT EXISTS observability;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: company; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA company;


--
-- Name: SCHEMA company; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA company IS 'Company-related data including organizations, departments, and KPI metrics';


--
-- Name: n8n; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA n8n;


--
-- Name: SCHEMA n8n; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA n8n IS 'Schema for n8n workflow automation tables and data';


--
-- Name: observability; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA observability;


--
-- Name: SCHEMA observability; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA observability IS 'Schema for Claude Code observability and event tracking';


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: update_theme_rating_stats(); Type: FUNCTION; Schema: observability; Owner: -
--

CREATE FUNCTION observability.update_theme_rating_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Recalculate average rating and count for the theme
    UPDATE observability.themes
    SET
        rating = (
            SELECT AVG(rating)::DECIMAL(3,2)
            FROM observability.theme_ratings
            WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id)
        ),
        rating_count = (
            SELECT COUNT(*)::INTEGER
            FROM observability.theme_ratings
            WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id)
        )
    WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: calculate_completion_percentage(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_completion_percentage(requirements jsonb) RETURNS integer
    LANGUAGE plpgsql
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


--
-- Name: cleanup_abandoned_conversations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_abandoned_conversations() RETURNS integer
    LANGUAGE plpgsql
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


--
-- Name: cleanup_old_jokes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_jokes() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM jokes_agent 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;


--
-- Name: cleanup_old_observability_events(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_observability_events(days_to_keep integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.observability_events
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_observability_events(days_to_keep integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_observability_events(days_to_keep integer) IS 'Optional cleanup function to delete events older than specified days. Not scheduled by default.';


--
-- Name: exec_sql(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.exec_sql(query text DEFAULT NULL::text, sql_query text DEFAULT NULL::text) RETURNS SETOF jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  q text := coalesce(query, sql_query);
  r record;
begin
  if q is null or length(trim(q)) = 0 then
    raise exception 'No SQL provided to exec_sql()';
  end if;

  -- Execute the query and stream rows as JSONB
  for r in execute q loop
    return next to_jsonb(r);
  end loop;
  return;

exception when others then
  -- Return a single JSON object describing the error (so callers get structured feedback)
  return query select jsonb_build_object(
    'error', true,
    'message', sqlerrm,
    'code', sqlstate
  );
end;
$$;


--
-- Name: get_global_model_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_global_model_config() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  SELECT value FROM public.system_settings WHERE key = 'model_config_global';
$$;


--
-- Name: log_agent_action(character varying, uuid, jsonb, jsonb, jsonb, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_agent_action(p_action character varying, p_agent_id uuid, p_details jsonb DEFAULT '{}'::jsonb, p_previous_state jsonb DEFAULT NULL::jsonb, p_new_state jsonb DEFAULT NULL::jsonb, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
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


--
-- Name: FUNCTION log_agent_action(p_action character varying, p_agent_id uuid, p_details jsonb, p_previous_state jsonb, p_new_state jsonb, p_success boolean, p_error_message text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_agent_action(p_action character varying, p_agent_id uuid, p_details jsonb, p_previous_state jsonb, p_new_state jsonb, p_success boolean, p_error_message text) IS 'Helper function to create audit log entries';


--
-- Name: set_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_agent_configurations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_configurations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_agent_skills_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_skills_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_agent_usage_analytics(uuid, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_usage_analytics(p_agent_id uuid, p_conversation_increment integer DEFAULT 0, p_message_increment integer DEFAULT 0, p_response_time_ms integer DEFAULT NULL::integer, p_error_increment integer DEFAULT 0, p_unique_user_increment integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql
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


--
-- Name: FUNCTION update_agent_usage_analytics(p_agent_id uuid, p_conversation_increment integer, p_message_increment integer, p_response_time_ms integer, p_error_increment integer, p_unique_user_increment integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_agent_usage_analytics(p_agent_id uuid, p_conversation_increment integer, p_message_increment integer, p_response_time_ms integer, p_error_increment integer, p_unique_user_increment integer) IS 'Helper function to update daily usage stats';


--
-- Name: update_completion_percentage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_completion_percentage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.completion_percentage = calculate_completion_percentage(NEW.requirements_gathered);
    RETURN NEW;
END;
$$;


--
-- Name: update_conversation_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_creation_metrics(boolean, integer, integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_creation_metrics(p_success boolean, p_creation_time_seconds integer DEFAULT NULL::integer, p_questions_answered integer DEFAULT NULL::integer, p_department character varying DEFAULT NULL::character varying) RETURNS void
    LANGUAGE plpgsql
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


--
-- Name: FUNCTION update_creation_metrics(p_success boolean, p_creation_time_seconds integer, p_questions_answered integer, p_department character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_creation_metrics(p_success boolean, p_creation_time_seconds integer, p_questions_answered integer, p_department character varying) IS 'Helper function to update system creation metrics';


--
-- Name: update_plans_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_plans_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validate_skill_examples(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_skill_examples(examples jsonb) RETURNS boolean
    LANGUAGE plpgsql
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: companies; Type: TABLE; Schema: company; Owner: -
--

CREATE TABLE company.companies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    industry character varying(100),
    founded_year integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE companies; Type: COMMENT; Schema: company; Owner: -
--

COMMENT ON TABLE company.companies IS 'Company information and metadata';


--
-- Name: departments; Type: TABLE; Schema: company; Owner: -
--

CREATE TABLE company.departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid,
    name character varying(255) NOT NULL,
    head_of_department character varying(255),
    budget numeric(15,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE departments; Type: COMMENT; Schema: company; Owner: -
--

COMMENT ON TABLE company.departments IS 'Company departments and organizational structure';


--
-- Name: kpi_data; Type: TABLE; Schema: company; Owner: -
--

CREATE TABLE company.kpi_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    department_id uuid,
    metric_id uuid,
    value numeric(15,4) NOT NULL,
    date_recorded date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE kpi_data; Type: COMMENT; Schema: company; Owner: -
--

COMMENT ON TABLE company.kpi_data IS 'Actual KPI data points and measurements';


--
-- Name: kpi_goals; Type: TABLE; Schema: company; Owner: -
--

CREATE TABLE company.kpi_goals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    department_id uuid,
    metric_id uuid,
    target_value numeric(15,4),
    period_start date,
    period_end date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE kpi_goals; Type: COMMENT; Schema: company; Owner: -
--

COMMENT ON TABLE company.kpi_goals IS 'Department KPI goals and targets';


--
-- Name: kpi_metrics; Type: TABLE; Schema: company; Owner: -
--

CREATE TABLE company.kpi_metrics (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    metric_type character varying(100),
    unit character varying(50),
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE kpi_metrics; Type: COMMENT; Schema: company; Owner: -
--

COMMENT ON TABLE company.kpi_metrics IS 'KPI metric definitions and metadata';


--
-- Name: annotation_tag_entity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.annotation_tag_entity (
    id character varying(16) NOT NULL,
    name character varying(24) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: auth_identity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.auth_identity (
    "userId" uuid,
    "providerId" character varying(64) NOT NULL,
    "providerType" character varying(32) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: auth_provider_sync_history; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.auth_provider_sync_history (
    id integer NOT NULL,
    "providerType" character varying(32) NOT NULL,
    "runMode" text NOT NULL,
    status text NOT NULL,
    "startedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    scanned integer NOT NULL,
    created integer NOT NULL,
    updated integer NOT NULL,
    disabled integer NOT NULL,
    error text
);


--
-- Name: auth_provider_sync_history_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

CREATE SEQUENCE n8n.auth_provider_sync_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_provider_sync_history_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n; Owner: -
--

ALTER SEQUENCE n8n.auth_provider_sync_history_id_seq OWNED BY n8n.auth_provider_sync_history.id;


--
-- Name: credentials_entity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.credentials_entity (
    name character varying(128) NOT NULL,
    data text NOT NULL,
    type character varying(128) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    id character varying(36) NOT NULL,
    "isManaged" boolean DEFAULT false NOT NULL
);


--
-- Name: data_table; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.data_table (
    id character varying(36) NOT NULL,
    name character varying(128) NOT NULL,
    "projectId" character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: data_table_column; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.data_table_column (
    id character varying(36) NOT NULL,
    name character varying(128) NOT NULL,
    type character varying(32) NOT NULL,
    index integer NOT NULL,
    "dataTableId" character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: COLUMN data_table_column.type; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.data_table_column.type IS 'Expected: string, number, boolean, or date (not enforced as a constraint)';


--
-- Name: COLUMN data_table_column.index; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.data_table_column.index IS 'Column order, starting from 0 (0 = first column)';


--
-- Name: event_destinations; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.event_destinations (
    id uuid NOT NULL,
    destination jsonb NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: execution_annotation_tags; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.execution_annotation_tags (
    "annotationId" integer NOT NULL,
    "tagId" character varying(24) NOT NULL
);


--
-- Name: execution_annotations; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.execution_annotations (
    id integer NOT NULL,
    "executionId" integer NOT NULL,
    vote character varying(6),
    note text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: execution_annotations_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

CREATE SEQUENCE n8n.execution_annotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_annotations_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n; Owner: -
--

ALTER SEQUENCE n8n.execution_annotations_id_seq OWNED BY n8n.execution_annotations.id;


--
-- Name: execution_data; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.execution_data (
    "executionId" integer NOT NULL,
    "workflowData" json NOT NULL,
    data text NOT NULL
);


--
-- Name: execution_entity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.execution_entity (
    id integer NOT NULL,
    finished boolean NOT NULL,
    mode character varying NOT NULL,
    "retryOf" character varying,
    "retrySuccessId" character varying,
    "startedAt" timestamp(3) with time zone,
    "stoppedAt" timestamp(3) with time zone,
    "waitTill" timestamp(3) with time zone,
    status character varying NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    "deletedAt" timestamp(3) with time zone,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: execution_entity_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

CREATE SEQUENCE n8n.execution_entity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_entity_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n; Owner: -
--

ALTER SEQUENCE n8n.execution_entity_id_seq OWNED BY n8n.execution_entity.id;


--
-- Name: execution_metadata; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.execution_metadata (
    id integer NOT NULL,
    "executionId" integer NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL
);


--
-- Name: execution_metadata_temp_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

CREATE SEQUENCE n8n.execution_metadata_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_metadata_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n; Owner: -
--

ALTER SEQUENCE n8n.execution_metadata_temp_id_seq OWNED BY n8n.execution_metadata.id;


--
-- Name: folder; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.folder (
    id character varying(36) NOT NULL,
    name character varying(128) NOT NULL,
    "parentFolderId" character varying(36),
    "projectId" character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: folder_tag; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.folder_tag (
    "folderId" character varying(36) NOT NULL,
    "tagId" character varying(36) NOT NULL
);


--
-- Name: insights_by_period; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.insights_by_period (
    id integer NOT NULL,
    "metaId" integer NOT NULL,
    type integer NOT NULL,
    value integer NOT NULL,
    "periodUnit" integer NOT NULL,
    "periodStart" timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN insights_by_period.type; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.insights_by_period.type IS '0: time_saved_minutes, 1: runtime_milliseconds, 2: success, 3: failure';


--
-- Name: COLUMN insights_by_period."periodUnit"; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.insights_by_period."periodUnit" IS '0: hour, 1: day, 2: week';


--
-- Name: insights_by_period_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

ALTER TABLE n8n.insights_by_period ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME n8n.insights_by_period_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insights_metadata; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.insights_metadata (
    "metaId" integer NOT NULL,
    "workflowId" character varying(16),
    "projectId" character varying(36),
    "workflowName" character varying(128) NOT NULL,
    "projectName" character varying(255) NOT NULL
);


--
-- Name: insights_metadata_metaId_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

ALTER TABLE n8n.insights_metadata ALTER COLUMN "metaId" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME n8n."insights_metadata_metaId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insights_raw; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.insights_raw (
    id integer NOT NULL,
    "metaId" integer NOT NULL,
    type integer NOT NULL,
    value integer NOT NULL,
    "timestamp" timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: COLUMN insights_raw.type; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.insights_raw.type IS '0: time_saved_minutes, 1: runtime_milliseconds, 2: success, 3: failure';


--
-- Name: insights_raw_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

ALTER TABLE n8n.insights_raw ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME n8n.insights_raw_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: installed_nodes; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.installed_nodes (
    name character varying(200) NOT NULL,
    type character varying(200) NOT NULL,
    "latestVersion" integer DEFAULT 1 NOT NULL,
    package character varying(241) NOT NULL
);


--
-- Name: installed_packages; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.installed_packages (
    "packageName" character varying(214) NOT NULL,
    "installedVersion" character varying(50) NOT NULL,
    "authorName" character varying(70),
    "authorEmail" character varying(70),
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: invalid_auth_token; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.invalid_auth_token (
    token character varying(512) NOT NULL,
    "expiresAt" timestamp(3) with time zone NOT NULL
);


--
-- Name: migration_metadata; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.migration_metadata (
    migration_file text NOT NULL,
    source text NOT NULL,
    workflow_id text,
    notes text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE migration_metadata; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON TABLE n8n.migration_metadata IS 'Tracks n8n workflow migration sources and metadata (moved to n8n schema for better organization)';


--
-- Name: COLUMN migration_metadata.source; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.migration_metadata.source IS 'Origin of the migration: dev, prod, or staging';


--
-- Name: COLUMN migration_metadata.workflow_id; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.migration_metadata.workflow_id IS 'References the n8n workflow this migration manages';


--
-- Name: migrations; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: n8n; Owner: -
--

CREATE SEQUENCE n8n.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n; Owner: -
--

ALTER SEQUENCE n8n.migrations_id_seq OWNED BY n8n.migrations.id;


--
-- Name: n8n_workflows; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.n8n_workflows (
    id text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    nodes jsonb NOT NULL,
    connections jsonb NOT NULL,
    settings jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE n8n_workflows; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON TABLE n8n.n8n_workflows IS 'Stores n8n workflow definitions for sync between environments (moved from public schema)';


--
-- Name: processed_data; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.processed_data (
    "workflowId" character varying(36) NOT NULL,
    context character varying(255) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    value text NOT NULL
);


--
-- Name: project; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.project (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    icon json,
    description character varying(512)
);


--
-- Name: project_relation; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.project_relation (
    "projectId" character varying(36) NOT NULL,
    "userId" uuid NOT NULL,
    role character varying NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: role; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.role (
    slug character varying(128) NOT NULL,
    "displayName" text,
    description text,
    "roleType" text,
    "systemRole" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: COLUMN role.slug; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.role.slug IS 'Unique identifier of the role for example: "global:owner"';


--
-- Name: COLUMN role."displayName"; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.role."displayName" IS 'Name used to display in the UI';


--
-- Name: COLUMN role.description; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.role.description IS 'Text describing the scope in more detail of users';


--
-- Name: COLUMN role."roleType"; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.role."roleType" IS 'Type of the role, e.g., global, project, or workflow';


--
-- Name: COLUMN role."systemRole"; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.role."systemRole" IS 'Indicates if the role is managed by the system and cannot be edited';


--
-- Name: role_scope; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.role_scope (
    "roleSlug" character varying(128) NOT NULL,
    "scopeSlug" character varying(128) NOT NULL
);


--
-- Name: scope; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.scope (
    slug character varying(128) NOT NULL,
    "displayName" text,
    description text
);


--
-- Name: COLUMN scope.slug; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.scope.slug IS 'Unique identifier of the scope for example: "project:create"';


--
-- Name: COLUMN scope."displayName"; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.scope."displayName" IS 'Name used to display in the UI';


--
-- Name: COLUMN scope.description; Type: COMMENT; Schema: n8n; Owner: -
--

COMMENT ON COLUMN n8n.scope.description IS 'Text describing the scope in more detail of users';


--
-- Name: settings; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    "loadOnStartup" boolean DEFAULT false NOT NULL
);


--
-- Name: shared_credentials; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.shared_credentials (
    "credentialsId" character varying(36) NOT NULL,
    "projectId" character varying(36) NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: shared_workflow; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.shared_workflow (
    "workflowId" character varying(36) NOT NULL,
    "projectId" character varying(36) NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: tag_entity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.tag_entity (
    name character varying(24) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    id character varying(36) NOT NULL
);


--
-- Name: test_case_execution; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.test_case_execution (
    id character varying(36) NOT NULL,
    "testRunId" character varying(36) NOT NULL,
    "executionId" integer,
    status character varying NOT NULL,
    "runAt" timestamp(3) with time zone,
    "completedAt" timestamp(3) with time zone,
    "errorCode" character varying,
    "errorDetails" json,
    metrics json,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    inputs json,
    outputs json
);


--
-- Name: test_run; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.test_run (
    id character varying(36) NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    status character varying NOT NULL,
    "errorCode" character varying,
    "errorDetails" json,
    "runAt" timestamp(3) with time zone,
    "completedAt" timestamp(3) with time zone,
    metrics json,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n."user" (
    id uuid DEFAULT uuid_in((OVERLAY(OVERLAY(md5((((random())::text || ':'::text) || (clock_timestamp())::text)) PLACING '4'::text FROM 13) PLACING to_hex((floor(((random() * (((11 - 8) + 1))::double precision) + (8)::double precision)))::integer) FROM 17))::cstring) NOT NULL,
    email character varying(255),
    "firstName" character varying(32),
    "lastName" character varying(32),
    password character varying(255),
    "personalizationAnswers" json,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    settings json,
    disabled boolean DEFAULT false NOT NULL,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    "mfaRecoveryCodes" text,
    "lastActiveAt" date,
    "roleSlug" character varying(128) DEFAULT 'global:member'::character varying NOT NULL
);


--
-- Name: user_api_keys; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.user_api_keys (
    id character varying(36) NOT NULL,
    "userId" uuid NOT NULL,
    label character varying(100) NOT NULL,
    "apiKey" character varying NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    scopes json
);


--
-- Name: variables; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.variables (
    key character varying(50) NOT NULL,
    type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    value character varying(255),
    id character varying(36) NOT NULL
);


--
-- Name: webhook_entity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.webhook_entity (
    "webhookPath" character varying NOT NULL,
    method character varying NOT NULL,
    node character varying NOT NULL,
    "webhookId" character varying,
    "pathLength" integer,
    "workflowId" character varying(36) NOT NULL
);


--
-- Name: workflow_entity; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.workflow_entity (
    name character varying(128) NOT NULL,
    active boolean NOT NULL,
    nodes json NOT NULL,
    connections json NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    settings json,
    "staticData" json,
    "pinData" json,
    "versionId" character(36),
    "triggerCount" integer DEFAULT 0 NOT NULL,
    id character varying(36) NOT NULL,
    meta json,
    "parentFolderId" character varying(36) DEFAULT NULL::character varying,
    "isArchived" boolean DEFAULT false NOT NULL
);


--
-- Name: workflow_history; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.workflow_history (
    "versionId" character varying(36) NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    authors character varying(255) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    nodes json NOT NULL,
    connections json NOT NULL
);


--
-- Name: workflow_statistics; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.workflow_statistics (
    count integer DEFAULT 0,
    "latestEvent" timestamp(3) with time zone,
    name character varying(128) NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    "rootCount" integer DEFAULT 0
);


--
-- Name: workflows_tags; Type: TABLE; Schema: n8n; Owner: -
--

CREATE TABLE n8n.workflows_tags (
    "workflowId" character varying(36) NOT NULL,
    "tagId" character varying(36) NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: observability; Owner: -
--

CREATE TABLE observability.events (
    id bigint NOT NULL,
    source_app text NOT NULL,
    session_id text NOT NULL,
    hook_event_type text NOT NULL,
    payload jsonb NOT NULL,
    chat jsonb,
    summary text,
    "timestamp" bigint NOT NULL,
    human_in_the_loop jsonb,
    human_in_the_loop_status jsonb,
    model_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE events; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON TABLE observability.events IS 'Claude Code hook events (PreToolUse, PostToolUse, etc.)';


--
-- Name: COLUMN events.payload; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON COLUMN observability.events.payload IS 'Full event payload as JSONB (flexible structure)';


--
-- Name: COLUMN events.chat; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON COLUMN observability.events.chat IS 'Chat transcript as JSONB array';


--
-- Name: COLUMN events.human_in_the_loop; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON COLUMN observability.events.human_in_the_loop IS 'Human-in-the-loop request data';


--
-- Name: COLUMN events.human_in_the_loop_status; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON COLUMN observability.events.human_in_the_loop_status IS 'HITL response status and data';


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: observability; Owner: -
--

CREATE SEQUENCE observability.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: observability; Owner: -
--

ALTER SEQUENCE observability.events_id_seq OWNED BY observability.events.id;


--
-- Name: theme_ratings; Type: TABLE; Schema: observability; Owner: -
--

CREATE TABLE observability.theme_ratings (
    id text NOT NULL,
    theme_id text NOT NULL,
    user_id text NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT theme_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: TABLE theme_ratings; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON TABLE observability.theme_ratings IS 'User ratings for themes';


--
-- Name: theme_shares; Type: TABLE; Schema: observability; Owner: -
--

CREATE TABLE observability.theme_shares (
    id text NOT NULL,
    theme_id text NOT NULL,
    share_token text NOT NULL,
    expires_at timestamp with time zone,
    is_public boolean DEFAULT false,
    allowed_users jsonb,
    created_at timestamp with time zone NOT NULL,
    access_count integer DEFAULT 0
);


--
-- Name: TABLE theme_shares; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON TABLE observability.theme_shares IS 'Shareable links for themes';


--
-- Name: themes; Type: TABLE; Schema: observability; Owner: -
--

CREATE TABLE observability.themes (
    id text NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    colors jsonb NOT NULL,
    is_public boolean DEFAULT false,
    author_id text,
    author_name text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb,
    download_count integer DEFAULT 0,
    rating numeric(3,2),
    rating_count integer DEFAULT 0
);


--
-- Name: TABLE themes; Type: COMMENT; Schema: observability; Owner: -
--

COMMENT ON TABLE observability.themes IS 'Custom color themes for the observability UI';


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_slug text,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text,
    agent_type text NOT NULL,
    mode_profile text NOT NULL,
    version text,
    status text DEFAULT 'active'::text,
    yaml text NOT NULL,
    context jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    function_code text,
    plan_structure jsonb,
    deliverable_structure jsonb,
    io_schema jsonb
);


--
-- Name: TABLE agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agents IS 'Database-backed agent descriptors for the new platform.';


--
-- Name: COLUMN agents.organization_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.organization_slug IS 'Namespace / organization identifier (e.g., demo, my-org).';


--
-- Name: COLUMN agents.yaml; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.yaml IS 'Raw YAML/JSON descriptor for auditability.';


--
-- Name: COLUMN agents.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.context IS 'System prompt, plan rubric, and reference data.';


--
-- Name: COLUMN agents.function_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.function_code IS 'JavaScript/TypeScript function code for function-type agents';


--
-- Name: COLUMN agents.plan_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.plan_structure IS 'JSON Schema defining the expected structure of plans created by this agent';


--
-- Name: COLUMN agents.deliverable_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.deliverable_structure IS 'JSON Schema defining the expected structure of deliverables created by this agent';


--
-- Name: COLUMN agents.io_schema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.io_schema IS 'JSON Schema defining technical input and output validation (types, constraints)';


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    storage text NOT NULL,
    path text,
    bucket text,
    object_key text,
    mime text NOT NULL,
    size bigint,
    width integer,
    height integer,
    hash text,
    user_id uuid,
    conversation_id uuid,
    deliverable_version_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_url text,
    CONSTRAINT assets_storage_check CHECK ((storage = ANY (ARRAY['local'::text, 'supabase'::text, 'external'::text])))
);


--
-- Name: cidafm_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cidafm_commands (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    type character varying(10) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    default_active boolean DEFAULT false,
    is_builtin boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cidafm_commands_type_check CHECK (((type)::text = ANY (ARRAY[('^'::character varying)::text, ('&'::character varying)::text, ('!'::character varying)::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    agent_name character varying(255),
    agent_type character varying(100),
    started_at timestamp with time zone,
    last_active_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_slug text,
    ended_at timestamp with time zone,
    primary_work_product_type character varying(100),
    primary_work_product_id uuid
);


--
-- Name: COLUMN conversations.organization_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.organization_slug IS 'Organization slug for database agents (e.g., my-org, acme-corp). NULL for file-based agents.';


--
-- Name: COLUMN conversations.primary_work_product_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.primary_work_product_type IS 'Type of the primary work product/deliverable for this conversation (e.g., blog_post, marketing_bundle, code_review)';


--
-- Name: COLUMN conversations.primary_work_product_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.primary_work_product_id IS 'UUID reference to the primary work product/deliverable record';


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    conversation_id uuid,
    method character varying(255),
    params jsonb DEFAULT '{}'::jsonb,
    prompt text,
    response text,
    status character varying(50) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    error_code text,
    error_message text,
    error_data jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    timeout_seconds integer DEFAULT 300,
    deliverable_type text,
    metadata jsonb DEFAULT '{}'::jsonb,
    llm_metadata jsonb DEFAULT '{}'::jsonb,
    response_metadata jsonb DEFAULT '{}'::jsonb,
    evaluation jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: conversations_with_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.conversations_with_stats AS
 SELECT c.id,
    c.user_id,
    c.agent_name,
    c.agent_type,
    c.ended_at,
    c.started_at,
    c.last_active_at,
    c.metadata,
    c.created_at,
    c.updated_at,
    COALESCE(task_stats.task_count, (0)::bigint) AS task_count,
    COALESCE(task_stats.completed_tasks, (0)::bigint) AS completed_tasks,
    COALESCE(task_stats.failed_tasks, (0)::bigint) AS failed_tasks,
    COALESCE(task_stats.active_tasks, (0)::bigint) AS active_tasks,
    c.organization_slug
   FROM (public.conversations c
     LEFT JOIN ( SELECT t.conversation_id,
            count(*) AS task_count,
            count(
                CASE
                    WHEN ((t.status)::text = 'completed'::text) THEN 1
                    ELSE NULL::integer
                END) AS completed_tasks,
            count(
                CASE
                    WHEN ((t.status)::text = 'failed'::text) THEN 1
                    ELSE NULL::integer
                END) AS failed_tasks,
            count(
                CASE
                    WHEN ((t.status)::text = ANY (ARRAY['pending'::text, 'running'::text])) THEN 1
                    ELSE NULL::integer
                END) AS active_tasks
           FROM public.tasks t
          GROUP BY t.conversation_id) task_stats ON ((c.id = task_stats.conversation_id)));


--
-- Name: deliverable_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliverable_versions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    deliverable_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text,
    format character varying(100),
    is_current_version boolean DEFAULT false,
    created_by_type character varying(50) DEFAULT 'ai_response'::character varying,
    task_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    file_attachments jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT deliverable_versions_created_by_type_check CHECK (((created_by_type)::text = ANY (ARRAY[('ai_response'::character varying)::text, ('manual_edit'::character varying)::text, ('ai_enhancement'::character varying)::text, ('user_request'::character varying)::text, ('conversation_task'::character varying)::text, ('conversation_merge'::character varying)::text, ('llm_rerun'::character varying)::text])))
);


--
-- Name: deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliverables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    agent_name text,
    title text NOT NULL,
    type character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: human_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.human_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_slug text,
    agent_slug text NOT NULL,
    conversation_id uuid,
    task_id text,
    mode text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by text,
    decision_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    orchestration_run_id uuid,
    orchestration_step_id uuid
);


--
-- Name: llm_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_models (
    model_name text NOT NULL,
    provider_name text NOT NULL,
    display_name text,
    model_type text DEFAULT 'text-generation'::text,
    model_version text,
    context_window integer DEFAULT 4096,
    max_output_tokens integer DEFAULT 2048,
    model_parameters_json jsonb DEFAULT '{}'::jsonb,
    pricing_info_json jsonb DEFAULT '{}'::jsonb,
    capabilities jsonb DEFAULT '[]'::jsonb,
    model_tier text,
    speed_tier text DEFAULT 'medium'::text,
    loading_priority integer DEFAULT 5,
    is_local boolean DEFAULT false,
    is_currently_loaded boolean DEFAULT false,
    is_active boolean DEFAULT true,
    training_data_cutoff date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: llm_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_providers (
    name text NOT NULL,
    display_name text NOT NULL,
    api_base_url text,
    configuration_json jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: llm_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_usage (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    run_id text NOT NULL,
    user_id uuid,
    conversation_id uuid,
    provider_name text,
    model_name text,
    input_tokens integer,
    output_tokens integer,
    input_cost numeric,
    output_cost numeric,
    duration_ms integer,
    status text DEFAULT 'completed'::text,
    caller_type text,
    agent_name text,
    is_local boolean DEFAULT false,
    model_tier text,
    fallback_used boolean DEFAULT false,
    routing_reason text,
    complexity_level text,
    complexity_score integer,
    data_classification text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    data_sanitization_applied boolean DEFAULT false,
    sanitization_level text DEFAULT 'none'::text,
    pii_detected boolean DEFAULT false,
    pii_types jsonb DEFAULT '[]'::jsonb,
    pseudonyms_used integer DEFAULT 0,
    pseudonym_types jsonb DEFAULT '[]'::jsonb,
    redactions_applied integer DEFAULT 0,
    redaction_types jsonb DEFAULT '[]'::jsonb,
    source_blinding_applied boolean DEFAULT false,
    headers_stripped boolean DEFAULT false,
    custom_user_agent_used boolean DEFAULT false,
    proxy_used boolean DEFAULT false,
    no_train_header_sent boolean DEFAULT false,
    no_retain_header_sent boolean DEFAULT false,
    sanitization_time_ms integer DEFAULT 0,
    reversal_context_size integer DEFAULT 0,
    policy_profile text,
    sovereign_mode boolean DEFAULT false,
    compliance_flags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    route text,
    total_cost numeric,
    pseudonym_mappings jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT llm_usage_route_check CHECK (((route IS NULL) OR (route = ANY (ARRAY['local'::text, 'remote'::text]))))
);


--
-- Name: COLUMN llm_usage.total_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_usage.total_cost IS 'Total cost for this LLM request (input_cost + output_cost)';


--
-- Name: COLUMN llm_usage.pseudonym_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_usage.pseudonym_mappings IS 'Array of {original, pseudonym, dataType} objects for this run';


--
-- Name: llm_usage_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.llm_usage_analytics AS
 SELECT (date_trunc('day'::text, started_at))::date AS date,
    COALESCE(caller_type, 'unknown'::text) AS caller_type,
    count(*) AS total_requests,
    sum(
        CASE
            WHEN (status = 'completed'::text) THEN 1
            ELSE 0
        END) AS successful_requests,
    COALESCE(sum(total_cost), sum((COALESCE(input_cost, (0)::numeric) + COALESCE(output_cost, (0)::numeric)))) AS total_cost,
    avg(COALESCE(duration_ms, 0)) AS avg_duration_ms,
    sum(
        CASE
            WHEN (is_local IS TRUE) THEN 1
            ELSE 0
        END) AS local_requests,
    sum(
        CASE
            WHEN (is_local IS NOT TRUE) THEN 1
            ELSE 0
        END) AS external_requests
   FROM public.llm_usage
  GROUP BY ((date_trunc('day'::text, started_at))::date), COALESCE(caller_type, 'unknown'::text)
  ORDER BY ((date_trunc('day'::text, started_at))::date) DESC, COALESCE(caller_type, 'unknown'::text);


--
-- Name: observability_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observability_events (
    id bigint NOT NULL,
    source_app text DEFAULT 'orchestrator-ai'::text NOT NULL,
    session_id text NOT NULL,
    hook_event_type text NOT NULL,
    user_id uuid,
    username text,
    conversation_id uuid,
    task_id uuid,
    agent_slug text,
    organization_slug text,
    mode text,
    status text,
    message text,
    progress integer,
    step text,
    payload jsonb NOT NULL,
    "timestamp" bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE observability_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.observability_events IS 'Real-time agent execution events for admin observability and monitoring';


--
-- Name: COLUMN observability_events.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.session_id IS 'conversationId or taskId used for grouping events';


--
-- Name: COLUMN observability_events.hook_event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.hook_event_type IS 'Event type: agent.started, agent.progress, agent.completed, agent.failed';


--
-- Name: COLUMN observability_events.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.username IS 'Cached display_name or email for performance';


--
-- Name: COLUMN observability_events.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.payload IS 'Full event payload as JSONB (flexible structure)';


--
-- Name: COLUMN observability_events."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events."timestamp" IS 'Event timestamp in milliseconds since epoch';


--
-- Name: observability_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.observability_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: observability_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.observability_events_id_seq OWNED BY public.observability_events.id;


--
-- Name: organization_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_credentials (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_slug text NOT NULL,
    alias text NOT NULL,
    credential_type text NOT NULL,
    encrypted_value bytea NOT NULL,
    encryption_metadata jsonb DEFAULT '{}'::jsonb,
    rotated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE organization_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_credentials IS 'Encrypted secrets per organization (API keys, service credentials).';


--
-- Name: plan_deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_deliverables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    plan_id uuid NOT NULL,
    deliverable_id uuid,
    label text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: plan_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    format text DEFAULT 'markdown'::text NOT NULL,
    created_by_type text NOT NULL,
    created_by_id uuid,
    task_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_current_version boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT plan_versions_created_by_type_check CHECK ((created_by_type = ANY (ARRAY['agent'::text, 'user'::text]))),
    CONSTRAINT plan_versions_format_check CHECK ((format = ANY (ARRAY['markdown'::text, 'json'::text, 'text'::text])))
);


--
-- Name: TABLE plan_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plan_versions IS 'Stores immutable versions of plans. Each edit/refinement creates a new version.';


--
-- Name: COLUMN plan_versions.created_by_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_versions.created_by_type IS 'Whether this version was created by an agent or manually edited by a user';


--
-- Name: COLUMN plan_versions.task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_versions.task_id IS 'Reference to the agent task that created this version (if applicable)';


--
-- Name: COLUMN plan_versions.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_versions.metadata IS 'Additional metadata like LLM model used, merge source versions, etc.';


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    agent_name text NOT NULL,
    namespace text NOT NULL,
    title text NOT NULL,
    current_version_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organization_slug text,
    agent_slug text,
    status text DEFAULT 'draft'::text,
    summary text,
    plan_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    approved_by uuid
);


--
-- Name: TABLE plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plans IS 'Structured execution plans, replacing conversation_plans.';


--
-- Name: COLUMN plans.current_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plans.current_version_id IS 'Points to the currently active version of this plan';


--
-- Name: COLUMN plans.plan_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plans.plan_json IS 'Plan structure with phases, steps, dependencies, checkpoints.';


--
-- Name: pseudonym_dictionaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pseudonym_dictionaries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    original_value text NOT NULL,
    pseudonym text NOT NULL,
    data_type character varying(100) NOT NULL,
    category character varying(100),
    frequency_weight integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_slug text,
    agent_slug text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: redaction_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redaction_patterns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    pattern_regex text NOT NULL,
    replacement text NOT NULL,
    description text,
    category character varying(100) DEFAULT 'pii_builtin'::character varying,
    priority integer DEFAULT 50,
    is_active boolean DEFAULT true,
    severity character varying(50),
    data_type character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_settings IS 'System-wide settings (key/value JSON). Used for global model configuration and feature flags.';


--
-- Name: task_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid,
    content text NOT NULL,
    message_type text DEFAULT 'info'::text NOT NULL,
    progress_percentage numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE task_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_messages IS 'Short-lived task streaming messages used for SSE + polling replay.';


--
-- Name: user_cidafm_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cidafm_commands (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    command_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    display_name character varying(255),
    role character varying(50),
    roles jsonb DEFAULT '["user"]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    namespace_access jsonb DEFAULT '["my-org"]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text,
    organization_slug text
);


--
-- Name: COLUMN users.namespace_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.namespace_access IS 'List of agent namespaces the user may access (e.g., ["demo","my-org"]).';


--
-- Name: auth_provider_sync_history id; Type: DEFAULT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.auth_provider_sync_history ALTER COLUMN id SET DEFAULT nextval('n8n.auth_provider_sync_history_id_seq'::regclass);


--
-- Name: execution_annotations id; Type: DEFAULT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_annotations ALTER COLUMN id SET DEFAULT nextval('n8n.execution_annotations_id_seq'::regclass);


--
-- Name: execution_entity id; Type: DEFAULT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_entity ALTER COLUMN id SET DEFAULT nextval('n8n.execution_entity_id_seq'::regclass);


--
-- Name: execution_metadata id; Type: DEFAULT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_metadata ALTER COLUMN id SET DEFAULT nextval('n8n.execution_metadata_temp_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.migrations ALTER COLUMN id SET DEFAULT nextval('n8n.migrations_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.events ALTER COLUMN id SET DEFAULT nextval('observability.events_id_seq'::regclass);


--
-- Name: observability_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events ALTER COLUMN id SET DEFAULT nextval('public.observability_events_id_seq'::regclass);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: kpi_data kpi_data_pkey; Type: CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_data
    ADD CONSTRAINT kpi_data_pkey PRIMARY KEY (id);


--
-- Name: kpi_goals kpi_goals_pkey; Type: CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_goals
    ADD CONSTRAINT kpi_goals_pkey PRIMARY KEY (id);


--
-- Name: kpi_metrics kpi_metrics_pkey; Type: CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_metrics
    ADD CONSTRAINT kpi_metrics_pkey PRIMARY KEY (id);


--
-- Name: test_run PK_011c050f566e9db509a0fadb9b9; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.test_run
    ADD CONSTRAINT "PK_011c050f566e9db509a0fadb9b9" PRIMARY KEY (id);


--
-- Name: installed_packages PK_08cc9197c39b028c1e9beca225940576fd1a5804; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.installed_packages
    ADD CONSTRAINT "PK_08cc9197c39b028c1e9beca225940576fd1a5804" PRIMARY KEY ("packageName");


--
-- Name: execution_metadata PK_17a0b6284f8d626aae88e1c16e4; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_metadata
    ADD CONSTRAINT "PK_17a0b6284f8d626aae88e1c16e4" PRIMARY KEY (id);


--
-- Name: project_relation PK_1caaa312a5d7184a003be0f0cb6; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.project_relation
    ADD CONSTRAINT "PK_1caaa312a5d7184a003be0f0cb6" PRIMARY KEY ("projectId", "userId");


--
-- Name: folder_tag PK_27e4e00852f6b06a925a4d83a3e; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.folder_tag
    ADD CONSTRAINT "PK_27e4e00852f6b06a925a4d83a3e" PRIMARY KEY ("folderId", "tagId");


--
-- Name: role PK_35c9b140caaf6da09cfabb0d675; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.role
    ADD CONSTRAINT "PK_35c9b140caaf6da09cfabb0d675" PRIMARY KEY (slug);


--
-- Name: project PK_4d68b1358bb5b766d3e78f32f57; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.project
    ADD CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY (id);


--
-- Name: invalid_auth_token PK_5779069b7235b256d91f7af1a15; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.invalid_auth_token
    ADD CONSTRAINT "PK_5779069b7235b256d91f7af1a15" PRIMARY KEY (token);


--
-- Name: shared_workflow PK_5ba87620386b847201c9531c58f; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.shared_workflow
    ADD CONSTRAINT "PK_5ba87620386b847201c9531c58f" PRIMARY KEY ("workflowId", "projectId");


--
-- Name: folder PK_6278a41a706740c94c02e288df8; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.folder
    ADD CONSTRAINT "PK_6278a41a706740c94c02e288df8" PRIMARY KEY (id);


--
-- Name: data_table_column PK_673cb121ee4a8a5e27850c72c51; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.data_table_column
    ADD CONSTRAINT "PK_673cb121ee4a8a5e27850c72c51" PRIMARY KEY (id);


--
-- Name: annotation_tag_entity PK_69dfa041592c30bbc0d4b84aa00; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.annotation_tag_entity
    ADD CONSTRAINT "PK_69dfa041592c30bbc0d4b84aa00" PRIMARY KEY (id);


--
-- Name: execution_annotations PK_7afcf93ffa20c4252869a7c6a23; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_annotations
    ADD CONSTRAINT "PK_7afcf93ffa20c4252869a7c6a23" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: installed_nodes PK_8ebd28194e4f792f96b5933423fc439df97d9689; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.installed_nodes
    ADD CONSTRAINT "PK_8ebd28194e4f792f96b5933423fc439df97d9689" PRIMARY KEY (name);


--
-- Name: shared_credentials PK_8ef3a59796a228913f251779cff; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.shared_credentials
    ADD CONSTRAINT "PK_8ef3a59796a228913f251779cff" PRIMARY KEY ("credentialsId", "projectId");


--
-- Name: test_case_execution PK_90c121f77a78a6580e94b794bce; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.test_case_execution
    ADD CONSTRAINT "PK_90c121f77a78a6580e94b794bce" PRIMARY KEY (id);


--
-- Name: user_api_keys PK_978fa5caa3468f463dac9d92e69; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.user_api_keys
    ADD CONSTRAINT "PK_978fa5caa3468f463dac9d92e69" PRIMARY KEY (id);


--
-- Name: execution_annotation_tags PK_979ec03d31294cca484be65d11f; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_annotation_tags
    ADD CONSTRAINT "PK_979ec03d31294cca484be65d11f" PRIMARY KEY ("annotationId", "tagId");


--
-- Name: webhook_entity PK_b21ace2e13596ccd87dc9bf4ea6; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.webhook_entity
    ADD CONSTRAINT "PK_b21ace2e13596ccd87dc9bf4ea6" PRIMARY KEY ("webhookPath", method);


--
-- Name: insights_by_period PK_b606942249b90cc39b0265f0575; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_by_period
    ADD CONSTRAINT "PK_b606942249b90cc39b0265f0575" PRIMARY KEY (id);


--
-- Name: workflow_history PK_b6572dd6173e4cd06fe79937b58; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflow_history
    ADD CONSTRAINT "PK_b6572dd6173e4cd06fe79937b58" PRIMARY KEY ("versionId");


--
-- Name: scope PK_bfc45df0481abd7f355d6187da1; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.scope
    ADD CONSTRAINT "PK_bfc45df0481abd7f355d6187da1" PRIMARY KEY (slug);


--
-- Name: processed_data PK_ca04b9d8dc72de268fe07a65773; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.processed_data
    ADD CONSTRAINT "PK_ca04b9d8dc72de268fe07a65773" PRIMARY KEY ("workflowId", context);


--
-- Name: settings PK_dc0fe14e6d9943f268e7b119f69ab8bd; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.settings
    ADD CONSTRAINT "PK_dc0fe14e6d9943f268e7b119f69ab8bd" PRIMARY KEY (key);


--
-- Name: data_table PK_e226d0001b9e6097cbfe70617cb; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.data_table
    ADD CONSTRAINT "PK_e226d0001b9e6097cbfe70617cb" PRIMARY KEY (id);


--
-- Name: user PK_ea8f538c94b6e352418254ed6474a81f; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n."user"
    ADD CONSTRAINT "PK_ea8f538c94b6e352418254ed6474a81f" PRIMARY KEY (id);


--
-- Name: insights_raw PK_ec15125755151e3a7e00e00014f; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_raw
    ADD CONSTRAINT "PK_ec15125755151e3a7e00e00014f" PRIMARY KEY (id);


--
-- Name: insights_metadata PK_f448a94c35218b6208ce20cf5a1; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_metadata
    ADD CONSTRAINT "PK_f448a94c35218b6208ce20cf5a1" PRIMARY KEY ("metaId");


--
-- Name: role_scope PK_role_scope; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.role_scope
    ADD CONSTRAINT "PK_role_scope" PRIMARY KEY ("roleSlug", "scopeSlug");


--
-- Name: data_table_column UQ_8082ec4890f892f0bc77473a123; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.data_table_column
    ADD CONSTRAINT "UQ_8082ec4890f892f0bc77473a123" UNIQUE ("dataTableId", name);


--
-- Name: data_table UQ_b23096ef747281ac944d28e8b0d; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.data_table
    ADD CONSTRAINT "UQ_b23096ef747281ac944d28e8b0d" UNIQUE ("projectId", name);


--
-- Name: user UQ_e12875dfb3b1d92d7d7c5377e2; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n."user"
    ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e2" UNIQUE (email);


--
-- Name: auth_identity auth_identity_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.auth_identity
    ADD CONSTRAINT auth_identity_pkey PRIMARY KEY ("providerId", "providerType");


--
-- Name: auth_provider_sync_history auth_provider_sync_history_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.auth_provider_sync_history
    ADD CONSTRAINT auth_provider_sync_history_pkey PRIMARY KEY (id);


--
-- Name: credentials_entity credentials_entity_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.credentials_entity
    ADD CONSTRAINT credentials_entity_pkey PRIMARY KEY (id);


--
-- Name: event_destinations event_destinations_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.event_destinations
    ADD CONSTRAINT event_destinations_pkey PRIMARY KEY (id);


--
-- Name: execution_data execution_data_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_data
    ADD CONSTRAINT execution_data_pkey PRIMARY KEY ("executionId");


--
-- Name: migration_metadata migration_metadata_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.migration_metadata
    ADD CONSTRAINT migration_metadata_pkey PRIMARY KEY (migration_file);


--
-- Name: n8n_workflows n8n_workflows_name_key; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.n8n_workflows
    ADD CONSTRAINT n8n_workflows_name_key UNIQUE (name);


--
-- Name: n8n_workflows n8n_workflows_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.n8n_workflows
    ADD CONSTRAINT n8n_workflows_pkey PRIMARY KEY (id);


--
-- Name: execution_entity pk_e3e63bbf986767844bbe1166d4e; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_entity
    ADD CONSTRAINT pk_e3e63bbf986767844bbe1166d4e PRIMARY KEY (id);


--
-- Name: workflow_statistics pk_workflow_statistics; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflow_statistics
    ADD CONSTRAINT pk_workflow_statistics PRIMARY KEY ("workflowId", name);


--
-- Name: workflows_tags pk_workflows_tags; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflows_tags
    ADD CONSTRAINT pk_workflows_tags PRIMARY KEY ("workflowId", "tagId");


--
-- Name: tag_entity tag_entity_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.tag_entity
    ADD CONSTRAINT tag_entity_pkey PRIMARY KEY (id);


--
-- Name: variables variables_key_key; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.variables
    ADD CONSTRAINT variables_key_key UNIQUE (key);


--
-- Name: variables variables_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.variables
    ADD CONSTRAINT variables_pkey PRIMARY KEY (id);


--
-- Name: workflow_entity workflow_entity_pkey; Type: CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflow_entity
    ADD CONSTRAINT workflow_entity_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: theme_ratings theme_ratings_pkey; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.theme_ratings
    ADD CONSTRAINT theme_ratings_pkey PRIMARY KEY (id);


--
-- Name: theme_shares theme_shares_pkey; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.theme_shares
    ADD CONSTRAINT theme_shares_pkey PRIMARY KEY (id);


--
-- Name: theme_shares theme_shares_share_token_key; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.theme_shares
    ADD CONSTRAINT theme_shares_share_token_key UNIQUE (share_token);


--
-- Name: themes themes_name_key; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.themes
    ADD CONSTRAINT themes_name_key UNIQUE (name);


--
-- Name: themes themes_pkey; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.themes
    ADD CONSTRAINT themes_pkey PRIMARY KEY (id);


--
-- Name: theme_ratings unique_user_theme_rating; Type: CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.theme_ratings
    ADD CONSTRAINT unique_user_theme_rating UNIQUE (theme_id, user_id);


--
-- Name: conversations agent_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT agent_conversations_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: agents agents_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_slug_unique UNIQUE (organization_slug, slug);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: cidafm_commands cidafm_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cidafm_commands
    ADD CONSTRAINT cidafm_commands_pkey PRIMARY KEY (id);


--
-- Name: deliverable_versions deliverable_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_pkey PRIMARY KEY (id);


--
-- Name: deliverables deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_pkey PRIMARY KEY (id);


--
-- Name: human_approvals human_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_approvals
    ADD CONSTRAINT human_approvals_pkey PRIMARY KEY (id);


--
-- Name: llm_models llm_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_models
    ADD CONSTRAINT llm_models_pkey PRIMARY KEY (provider_name, model_name);


--
-- Name: llm_providers llm_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_providers
    ADD CONSTRAINT llm_providers_pkey PRIMARY KEY (name);


--
-- Name: llm_usage llm_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);


--
-- Name: llm_usage llm_usage_run_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_run_id_key UNIQUE (run_id);


--
-- Name: observability_events observability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_pkey PRIMARY KEY (id);


--
-- Name: organization_credentials organization_credentials_alias_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT organization_credentials_alias_unique UNIQUE (organization_slug, alias);


--
-- Name: organization_credentials organization_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT organization_credentials_pkey PRIMARY KEY (id);


--
-- Name: plan_deliverables plan_deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_deliverables
    ADD CONSTRAINT plan_deliverables_pkey PRIMARY KEY (id);


--
-- Name: plan_versions plan_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: pseudonym_dictionaries pseudonym_dictionaries_original_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pseudonym_dictionaries
    ADD CONSTRAINT pseudonym_dictionaries_original_value_key UNIQUE (original_value);


--
-- Name: pseudonym_dictionaries pseudonym_dictionaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pseudonym_dictionaries
    ADD CONSTRAINT pseudonym_dictionaries_pkey PRIMARY KEY (id);


--
-- Name: redaction_patterns redaction_patterns_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redaction_patterns
    ADD CONSTRAINT redaction_patterns_name_key UNIQUE (name);


--
-- Name: redaction_patterns redaction_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redaction_patterns
    ADD CONSTRAINT redaction_patterns_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: task_messages task_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: plans unique_conversation_plan; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT unique_conversation_plan UNIQUE (conversation_id);


--
-- Name: plan_versions unique_plan_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT unique_plan_version UNIQUE (plan_id, version_number);


--
-- Name: user_cidafm_commands user_cidafm_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_14f68deffaf858465715995508; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_14f68deffaf858465715995508" ON n8n.folder USING btree ("projectId", id);


--
-- Name: IDX_1d8ab99d5861c9388d2dc1cf73; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_1d8ab99d5861c9388d2dc1cf73" ON n8n.insights_metadata USING btree ("workflowId");


--
-- Name: IDX_1e31657f5fe46816c34be7c1b4; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_1e31657f5fe46816c34be7c1b4" ON n8n.workflow_history USING btree ("workflowId");


--
-- Name: IDX_1ef35bac35d20bdae979d917a3; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_1ef35bac35d20bdae979d917a3" ON n8n.user_api_keys USING btree ("apiKey");


--
-- Name: IDX_5f0643f6717905a05164090dde; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_5f0643f6717905a05164090dde" ON n8n.project_relation USING btree ("userId");


--
-- Name: IDX_60b6a84299eeb3f671dfec7693; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_60b6a84299eeb3f671dfec7693" ON n8n.insights_by_period USING btree ("periodStart", type, "periodUnit", "metaId");


--
-- Name: IDX_61448d56d61802b5dfde5cdb00; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_61448d56d61802b5dfde5cdb00" ON n8n.project_relation USING btree ("projectId");


--
-- Name: IDX_63d7bbae72c767cf162d459fcc; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_63d7bbae72c767cf162d459fcc" ON n8n.user_api_keys USING btree ("userId", label);


--
-- Name: IDX_8e4b4774db42f1e6dda3452b2a; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_8e4b4774db42f1e6dda3452b2a" ON n8n.test_case_execution USING btree ("testRunId");


--
-- Name: IDX_97f863fa83c4786f1956508496; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_97f863fa83c4786f1956508496" ON n8n.execution_annotations USING btree ("executionId");


--
-- Name: IDX_a3697779b366e131b2bbdae297; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_a3697779b366e131b2bbdae297" ON n8n.execution_annotation_tags USING btree ("tagId");


--
-- Name: IDX_ae51b54c4bb430cf92f48b623f; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_ae51b54c4bb430cf92f48b623f" ON n8n.annotation_tag_entity USING btree (name);


--
-- Name: IDX_c1519757391996eb06064f0e7c; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_c1519757391996eb06064f0e7c" ON n8n.execution_annotation_tags USING btree ("annotationId");


--
-- Name: IDX_cec8eea3bf49551482ccb4933e; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX "IDX_cec8eea3bf49551482ccb4933e" ON n8n.execution_metadata USING btree ("executionId", key);


--
-- Name: IDX_d6870d3b6e4c185d33926f423c; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_d6870d3b6e4c185d33926f423c" ON n8n.test_run USING btree ("workflowId");


--
-- Name: IDX_execution_entity_deletedAt; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_execution_entity_deletedAt" ON n8n.execution_entity USING btree ("deletedAt");


--
-- Name: IDX_role_scope_scopeSlug; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_role_scope_scopeSlug" ON n8n.role_scope USING btree ("scopeSlug");


--
-- Name: IDX_workflow_entity_name; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX "IDX_workflow_entity_name" ON n8n.workflow_entity USING btree (name);


--
-- Name: idx_07fde106c0b471d8cc80a64fc8; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_07fde106c0b471d8cc80a64fc8 ON n8n.credentials_entity USING btree (type);


--
-- Name: idx_16f4436789e804e3e1c9eeb240; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_16f4436789e804e3e1c9eeb240 ON n8n.webhook_entity USING btree ("webhookId", method, "pathLength");


--
-- Name: idx_812eb05f7451ca757fb98444ce; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX idx_812eb05f7451ca757fb98444ce ON n8n.tag_entity USING btree (name);


--
-- Name: idx_execution_entity_stopped_at_status_deleted_at; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_execution_entity_stopped_at_status_deleted_at ON n8n.execution_entity USING btree ("stoppedAt", status, "deletedAt") WHERE (("stoppedAt" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: idx_execution_entity_wait_till_status_deleted_at; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_execution_entity_wait_till_status_deleted_at ON n8n.execution_entity USING btree ("waitTill", status, "deletedAt") WHERE (("waitTill" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: idx_execution_entity_workflow_id_started_at; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_execution_entity_workflow_id_started_at ON n8n.execution_entity USING btree ("workflowId", "startedAt") WHERE (("startedAt" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: idx_migration_metadata_source; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_migration_metadata_source ON n8n.migration_metadata USING btree (source);


--
-- Name: idx_migration_metadata_workflow; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_migration_metadata_workflow ON n8n.migration_metadata USING btree (workflow_id);


--
-- Name: idx_n8n_workflows_active; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_n8n_workflows_active ON n8n.n8n_workflows USING btree (active);


--
-- Name: idx_n8n_workflows_name; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_n8n_workflows_name ON n8n.n8n_workflows USING btree (name);


--
-- Name: idx_n8n_workflows_updated; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_n8n_workflows_updated ON n8n.n8n_workflows USING btree (updated_at);


--
-- Name: idx_n8n_workflows_updated_at; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_n8n_workflows_updated_at ON n8n.n8n_workflows USING btree (updated_at DESC);


--
-- Name: idx_workflows_tags_workflow_id; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_workflows_tags_workflow_id ON n8n.workflows_tags USING btree ("workflowId");


--
-- Name: pk_credentials_entity_id; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX pk_credentials_entity_id ON n8n.credentials_entity USING btree (id);


--
-- Name: pk_tag_entity_id; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX pk_tag_entity_id ON n8n.tag_entity USING btree (id);


--
-- Name: pk_variables_id; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX pk_variables_id ON n8n.variables USING btree (id);


--
-- Name: pk_workflow_entity_id; Type: INDEX; Schema: n8n; Owner: -
--

CREATE UNIQUE INDEX pk_workflow_entity_id ON n8n.workflow_entity USING btree (id);


--
-- Name: project_relation_role_idx; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX project_relation_role_idx ON n8n.project_relation USING btree (role);


--
-- Name: project_relation_role_project_idx; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX project_relation_role_project_idx ON n8n.project_relation USING btree ("projectId", role);


--
-- Name: user_role_idx; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX user_role_idx ON n8n."user" USING btree ("roleSlug");


--
-- Name: idx_events_created_at; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_created_at ON observability.events USING btree (created_at DESC);


--
-- Name: idx_events_hook_event_type; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_hook_event_type ON observability.events USING btree (hook_event_type);


--
-- Name: idx_events_model_name; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_model_name ON observability.events USING btree (model_name) WHERE (model_name IS NOT NULL);


--
-- Name: idx_events_payload_gin; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_payload_gin ON observability.events USING gin (payload);


--
-- Name: idx_events_session_id; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_session_id ON observability.events USING btree (session_id);


--
-- Name: idx_events_source_app; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_source_app ON observability.events USING btree (source_app);


--
-- Name: idx_events_timestamp; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_events_timestamp ON observability.events USING btree ("timestamp" DESC);


--
-- Name: idx_theme_ratings_theme_id; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_theme_ratings_theme_id ON observability.theme_ratings USING btree (theme_id);


--
-- Name: idx_theme_ratings_user_id; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_theme_ratings_user_id ON observability.theme_ratings USING btree (user_id);


--
-- Name: idx_theme_shares_expires_at; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_theme_shares_expires_at ON observability.theme_shares USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_theme_shares_theme_id; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_theme_shares_theme_id ON observability.theme_shares USING btree (theme_id);


--
-- Name: idx_theme_shares_token; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_theme_shares_token ON observability.theme_shares USING btree (share_token);


--
-- Name: idx_themes_author_id; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_themes_author_id ON observability.themes USING btree (author_id) WHERE (author_id IS NOT NULL);


--
-- Name: idx_themes_created_at; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_themes_created_at ON observability.themes USING btree (created_at DESC);


--
-- Name: idx_themes_is_public; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_themes_is_public ON observability.themes USING btree (is_public);


--
-- Name: idx_themes_name; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_themes_name ON observability.themes USING btree (name);


--
-- Name: idx_themes_rating; Type: INDEX; Schema: observability; Owner: -
--

CREATE INDEX idx_themes_rating ON observability.themes USING btree (rating DESC NULLS LAST);


--
-- Name: assets_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_conversation_idx ON public.assets USING btree (conversation_id);


--
-- Name: assets_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_version_idx ON public.assets USING btree (deliverable_version_id);


--
-- Name: human_approvals_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX human_approvals_conversation_idx ON public.human_approvals USING btree (conversation_id);


--
-- Name: human_approvals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX human_approvals_status_idx ON public.human_approvals USING btree (status);


--
-- Name: idx_agent_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_agents_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_org_slug ON public.agents USING btree (organization_slug);


--
-- Name: idx_agents_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_slug ON public.agents USING btree (slug);


--
-- Name: idx_conversations_org_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_org_agent ON public.conversations USING btree (organization_slug, agent_name);


--
-- Name: idx_conversations_organization_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_organization_slug ON public.conversations USING btree (organization_slug);


--
-- Name: idx_conversations_work_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_work_product ON public.conversations USING btree (primary_work_product_type, primary_work_product_id);


--
-- Name: idx_human_approvals_orch_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_approvals_orch_run ON public.human_approvals USING btree (orchestration_run_id);


--
-- Name: idx_human_approvals_orch_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_approvals_orch_step ON public.human_approvals USING btree (orchestration_step_id);


--
-- Name: idx_llm_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_created_at ON public.llm_usage USING btree (created_at);


--
-- Name: idx_llm_usage_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_run_id ON public.llm_usage USING btree (run_id);


--
-- Name: idx_observability_events_agent_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_agent_slug ON public.observability_events USING btree (agent_slug) WHERE (agent_slug IS NOT NULL);


--
-- Name: idx_observability_events_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_conversation_id ON public.observability_events USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);


--
-- Name: idx_observability_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_created_at ON public.observability_events USING btree (created_at DESC);


--
-- Name: idx_observability_events_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_task_id ON public.observability_events USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_observability_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_timestamp ON public.observability_events USING btree ("timestamp" DESC);


--
-- Name: idx_observability_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_user_id ON public.observability_events USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_org_credentials_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_credentials_org ON public.organization_credentials USING btree (organization_slug);


--
-- Name: idx_plan_deliverables_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_deliverables_plan ON public.plan_deliverables USING btree (plan_id);


--
-- Name: idx_plan_versions_is_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_versions_is_current ON public.plan_versions USING btree (is_current_version) WHERE (is_current_version = true);


--
-- Name: idx_plan_versions_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_versions_plan_id ON public.plan_versions USING btree (plan_id);


--
-- Name: idx_plan_versions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_versions_task_id ON public.plan_versions USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_plans_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_conversation ON public.plans USING btree (conversation_id);


--
-- Name: idx_plans_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_conversation_id ON public.plans USING btree (conversation_id);


--
-- Name: idx_plans_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_org_slug ON public.plans USING btree (organization_slug);


--
-- Name: idx_plans_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_user_id ON public.plans USING btree (user_id);


--
-- Name: idx_pseudonym_dictionaries_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_agent ON public.pseudonym_dictionaries USING btree (agent_slug);


--
-- Name: idx_pseudonym_dictionaries_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_org ON public.pseudonym_dictionaries USING btree (organization_slug);


--
-- Name: idx_pseudonym_dictionaries_original_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_original_value ON public.pseudonym_dictionaries USING btree (original_value);


--
-- Name: idx_pseudonym_dictionaries_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_updated_at ON public.pseudonym_dictionaries USING btree (updated_at);


--
-- Name: idx_redaction_patterns_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redaction_patterns_active ON public.redaction_patterns USING btree (is_active, priority);


--
-- Name: idx_task_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_created_at ON public.task_messages USING btree (created_at DESC);


--
-- Name: idx_task_messages_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_task_id ON public.task_messages USING btree (task_id);


--
-- Name: idx_task_messages_task_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_task_id_created_at ON public.task_messages USING btree (task_id, created_at DESC);


--
-- Name: idx_tasks_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_conversation_id ON public.tasks USING btree (conversation_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: llm_usage_route_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_route_idx ON public.llm_usage USING btree (route);


--
-- Name: llm_usage_route_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_route_started_at_idx ON public.llm_usage USING btree (route, started_at DESC);


--
-- Name: llm_usage_run_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX llm_usage_run_id_unique ON public.llm_usage USING btree (run_id);


--
-- Name: llm_usage_total_cost_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_total_cost_idx ON public.llm_usage USING btree (total_cost) WHERE (total_cost IS NOT NULL);


--
-- Name: theme_ratings trigger_update_theme_rating_stats; Type: TRIGGER; Schema: observability; Owner: -
--

CREATE TRIGGER trigger_update_theme_rating_stats AFTER INSERT OR DELETE OR UPDATE ON observability.theme_ratings FOR EACH ROW EXECUTE FUNCTION observability.update_theme_rating_stats();


--
-- Name: assets set_timestamp_updated_at_assets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_updated_at_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- Name: human_approvals set_timestamp_updated_at_human_approvals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_updated_at_human_approvals BEFORE UPDATE ON public.human_approvals FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- Name: plans trigger_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_plans_updated_at();


--
-- Name: departments departments_company_id_fkey; Type: FK CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.departments
    ADD CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) REFERENCES company.companies(id) ON DELETE CASCADE;


--
-- Name: kpi_data kpi_data_department_id_fkey; Type: FK CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_data
    ADD CONSTRAINT kpi_data_department_id_fkey FOREIGN KEY (department_id) REFERENCES company.departments(id) ON DELETE CASCADE;


--
-- Name: kpi_data kpi_data_metric_id_fkey; Type: FK CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_data
    ADD CONSTRAINT kpi_data_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES company.kpi_metrics(id) ON DELETE CASCADE;


--
-- Name: kpi_goals kpi_goals_department_id_fkey; Type: FK CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_goals
    ADD CONSTRAINT kpi_goals_department_id_fkey FOREIGN KEY (department_id) REFERENCES company.departments(id) ON DELETE CASCADE;


--
-- Name: kpi_goals kpi_goals_metric_id_fkey; Type: FK CONSTRAINT; Schema: company; Owner: -
--

ALTER TABLE ONLY company.kpi_goals
    ADD CONSTRAINT kpi_goals_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES company.kpi_metrics(id) ON DELETE CASCADE;


--
-- Name: processed_data FK_06a69a7032c97a763c2c7599464; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.processed_data
    ADD CONSTRAINT "FK_06a69a7032c97a763c2c7599464" FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: insights_metadata FK_1d8ab99d5861c9388d2dc1cf733; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_metadata
    ADD CONSTRAINT "FK_1d8ab99d5861c9388d2dc1cf733" FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE SET NULL;


--
-- Name: workflow_history FK_1e31657f5fe46816c34be7c1b4b; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflow_history
    ADD CONSTRAINT "FK_1e31657f5fe46816c34be7c1b4b" FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: insights_metadata FK_2375a1eda085adb16b24615b69c; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_metadata
    ADD CONSTRAINT "FK_2375a1eda085adb16b24615b69c" FOREIGN KEY ("projectId") REFERENCES n8n.project(id) ON DELETE SET NULL;


--
-- Name: execution_metadata FK_31d0b4c93fb85ced26f6005cda3; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_metadata
    ADD CONSTRAINT "FK_31d0b4c93fb85ced26f6005cda3" FOREIGN KEY ("executionId") REFERENCES n8n.execution_entity(id) ON DELETE CASCADE;


--
-- Name: shared_credentials FK_416f66fc846c7c442970c094ccf; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.shared_credentials
    ADD CONSTRAINT "FK_416f66fc846c7c442970c094ccf" FOREIGN KEY ("credentialsId") REFERENCES n8n.credentials_entity(id) ON DELETE CASCADE;


--
-- Name: project_relation FK_5f0643f6717905a05164090dde7; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.project_relation
    ADD CONSTRAINT "FK_5f0643f6717905a05164090dde7" FOREIGN KEY ("userId") REFERENCES n8n."user"(id) ON DELETE CASCADE;


--
-- Name: project_relation FK_61448d56d61802b5dfde5cdb002; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.project_relation
    ADD CONSTRAINT "FK_61448d56d61802b5dfde5cdb002" FOREIGN KEY ("projectId") REFERENCES n8n.project(id) ON DELETE CASCADE;


--
-- Name: insights_by_period FK_6414cfed98daabbfdd61a1cfbc0; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_by_period
    ADD CONSTRAINT "FK_6414cfed98daabbfdd61a1cfbc0" FOREIGN KEY ("metaId") REFERENCES n8n.insights_metadata("metaId") ON DELETE CASCADE;


--
-- Name: insights_raw FK_6e2e33741adef2a7c5d66befa4e; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.insights_raw
    ADD CONSTRAINT "FK_6e2e33741adef2a7c5d66befa4e" FOREIGN KEY ("metaId") REFERENCES n8n.insights_metadata("metaId") ON DELETE CASCADE;


--
-- Name: installed_nodes FK_73f857fc5dce682cef8a99c11dbddbc969618951; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.installed_nodes
    ADD CONSTRAINT "FK_73f857fc5dce682cef8a99c11dbddbc969618951" FOREIGN KEY (package) REFERENCES n8n.installed_packages("packageName") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: folder FK_804ea52f6729e3940498bd54d78; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.folder
    ADD CONSTRAINT "FK_804ea52f6729e3940498bd54d78" FOREIGN KEY ("parentFolderId") REFERENCES n8n.folder(id) ON DELETE CASCADE;


--
-- Name: shared_credentials FK_812c2852270da1247756e77f5a4; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.shared_credentials
    ADD CONSTRAINT "FK_812c2852270da1247756e77f5a4" FOREIGN KEY ("projectId") REFERENCES n8n.project(id) ON DELETE CASCADE;


--
-- Name: test_case_execution FK_8e4b4774db42f1e6dda3452b2af; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.test_case_execution
    ADD CONSTRAINT "FK_8e4b4774db42f1e6dda3452b2af" FOREIGN KEY ("testRunId") REFERENCES n8n.test_run(id) ON DELETE CASCADE;


--
-- Name: data_table_column FK_930b6e8faaf88294cef23484160; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.data_table_column
    ADD CONSTRAINT "FK_930b6e8faaf88294cef23484160" FOREIGN KEY ("dataTableId") REFERENCES n8n.data_table(id) ON DELETE CASCADE;


--
-- Name: folder_tag FK_94a60854e06f2897b2e0d39edba; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.folder_tag
    ADD CONSTRAINT "FK_94a60854e06f2897b2e0d39edba" FOREIGN KEY ("folderId") REFERENCES n8n.folder(id) ON DELETE CASCADE;


--
-- Name: execution_annotations FK_97f863fa83c4786f19565084960; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_annotations
    ADD CONSTRAINT "FK_97f863fa83c4786f19565084960" FOREIGN KEY ("executionId") REFERENCES n8n.execution_entity(id) ON DELETE CASCADE;


--
-- Name: execution_annotation_tags FK_a3697779b366e131b2bbdae2976; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_annotation_tags
    ADD CONSTRAINT "FK_a3697779b366e131b2bbdae2976" FOREIGN KEY ("tagId") REFERENCES n8n.annotation_tag_entity(id) ON DELETE CASCADE;


--
-- Name: shared_workflow FK_a45ea5f27bcfdc21af9b4188560; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.shared_workflow
    ADD CONSTRAINT "FK_a45ea5f27bcfdc21af9b4188560" FOREIGN KEY ("projectId") REFERENCES n8n.project(id) ON DELETE CASCADE;


--
-- Name: folder FK_a8260b0b36939c6247f385b8221; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.folder
    ADD CONSTRAINT "FK_a8260b0b36939c6247f385b8221" FOREIGN KEY ("projectId") REFERENCES n8n.project(id) ON DELETE CASCADE;


--
-- Name: execution_annotation_tags FK_c1519757391996eb06064f0e7c8; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_annotation_tags
    ADD CONSTRAINT "FK_c1519757391996eb06064f0e7c8" FOREIGN KEY ("annotationId") REFERENCES n8n.execution_annotations(id) ON DELETE CASCADE;


--
-- Name: data_table FK_c2a794257dee48af7c9abf681de; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.data_table
    ADD CONSTRAINT "FK_c2a794257dee48af7c9abf681de" FOREIGN KEY ("projectId") REFERENCES n8n.project(id) ON DELETE CASCADE;


--
-- Name: project_relation FK_c6b99592dc96b0d836d7a21db91; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.project_relation
    ADD CONSTRAINT "FK_c6b99592dc96b0d836d7a21db91" FOREIGN KEY (role) REFERENCES n8n.role(slug);


--
-- Name: test_run FK_d6870d3b6e4c185d33926f423c8; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.test_run
    ADD CONSTRAINT "FK_d6870d3b6e4c185d33926f423c8" FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: shared_workflow FK_daa206a04983d47d0a9c34649ce; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.shared_workflow
    ADD CONSTRAINT "FK_daa206a04983d47d0a9c34649ce" FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: folder_tag FK_dc88164176283de80af47621746; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.folder_tag
    ADD CONSTRAINT "FK_dc88164176283de80af47621746" FOREIGN KEY ("tagId") REFERENCES n8n.tag_entity(id) ON DELETE CASCADE;


--
-- Name: user_api_keys FK_e131705cbbc8fb589889b02d457; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.user_api_keys
    ADD CONSTRAINT "FK_e131705cbbc8fb589889b02d457" FOREIGN KEY ("userId") REFERENCES n8n."user"(id) ON DELETE CASCADE;


--
-- Name: test_case_execution FK_e48965fac35d0f5b9e7f51d8c44; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.test_case_execution
    ADD CONSTRAINT "FK_e48965fac35d0f5b9e7f51d8c44" FOREIGN KEY ("executionId") REFERENCES n8n.execution_entity(id) ON DELETE SET NULL;


--
-- Name: user FK_eaea92ee7bfb9c1b6cd01505d56; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n."user"
    ADD CONSTRAINT "FK_eaea92ee7bfb9c1b6cd01505d56" FOREIGN KEY ("roleSlug") REFERENCES n8n.role(slug);


--
-- Name: role_scope FK_role; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.role_scope
    ADD CONSTRAINT "FK_role" FOREIGN KEY ("roleSlug") REFERENCES n8n.role(slug) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_scope FK_scope; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.role_scope
    ADD CONSTRAINT "FK_scope" FOREIGN KEY ("scopeSlug") REFERENCES n8n.scope(slug) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: auth_identity auth_identity_userId_fkey; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.auth_identity
    ADD CONSTRAINT "auth_identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES n8n."user"(id);


--
-- Name: execution_data execution_data_fk; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_data
    ADD CONSTRAINT execution_data_fk FOREIGN KEY ("executionId") REFERENCES n8n.execution_entity(id) ON DELETE CASCADE;


--
-- Name: execution_entity fk_execution_entity_workflow_id; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.execution_entity
    ADD CONSTRAINT fk_execution_entity_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: webhook_entity fk_webhook_entity_workflow_id; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.webhook_entity
    ADD CONSTRAINT fk_webhook_entity_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: workflow_entity fk_workflow_parent_folder; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflow_entity
    ADD CONSTRAINT fk_workflow_parent_folder FOREIGN KEY ("parentFolderId") REFERENCES n8n.folder(id) ON DELETE CASCADE;


--
-- Name: workflow_statistics fk_workflow_statistics_workflow_id; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflow_statistics
    ADD CONSTRAINT fk_workflow_statistics_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: workflows_tags fk_workflows_tags_tag_id; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflows_tags
    ADD CONSTRAINT fk_workflows_tags_tag_id FOREIGN KEY ("tagId") REFERENCES n8n.tag_entity(id) ON DELETE CASCADE;


--
-- Name: workflows_tags fk_workflows_tags_workflow_id; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.workflows_tags
    ADD CONSTRAINT fk_workflows_tags_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: migration_metadata migration_metadata_workflow_id_fkey; Type: FK CONSTRAINT; Schema: n8n; Owner: -
--

ALTER TABLE ONLY n8n.migration_metadata
    ADD CONSTRAINT migration_metadata_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES n8n.n8n_workflows(id);


--
-- Name: theme_ratings fk_theme_ratings_theme; Type: FK CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.theme_ratings
    ADD CONSTRAINT fk_theme_ratings_theme FOREIGN KEY (theme_id) REFERENCES observability.themes(id) ON DELETE CASCADE;


--
-- Name: theme_shares fk_theme_shares_theme; Type: FK CONSTRAINT; Schema: observability; Owner: -
--

ALTER TABLE ONLY observability.theme_shares
    ADD CONSTRAINT fk_theme_shares_theme FOREIGN KEY (theme_id) REFERENCES observability.themes(id) ON DELETE CASCADE;


--
-- Name: conversations agent_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT agent_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: assets assets_deliverable_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_deliverable_version_id_fkey FOREIGN KEY (deliverable_version_id) REFERENCES public.deliverable_versions(id) ON DELETE SET NULL;


--
-- Name: deliverable_versions deliverable_versions_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE CASCADE;


--
-- Name: deliverable_versions deliverable_versions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: deliverables deliverables_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: plans fk_plans_current_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT fk_plans_current_version FOREIGN KEY (current_version_id) REFERENCES public.plan_versions(id) ON DELETE SET NULL;


--
-- Name: llm_models llm_models_provider_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_models
    ADD CONSTRAINT llm_models_provider_name_fkey FOREIGN KEY (provider_name) REFERENCES public.llm_providers(name) ON DELETE CASCADE;


--
-- Name: llm_usage llm_usage_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: observability_events observability_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: observability_events observability_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: observability_events observability_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plan_deliverables plan_deliverables_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_deliverables
    ADD CONSTRAINT plan_deliverables_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE SET NULL;


--
-- Name: plan_deliverables plan_deliverables_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_deliverables
    ADD CONSTRAINT plan_deliverables_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_versions plan_versions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plans plans_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: plans plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: task_messages task_messages_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_cidafm_commands user_cidafm_commands_command_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_command_id_fkey FOREIGN KEY (command_id) REFERENCES public.cidafm_commands(id) ON DELETE CASCADE;


--
-- Name: user_cidafm_commands user_cidafm_commands_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plan_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_versions plan_versions_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_delete_policy ON public.plan_versions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plan_versions plan_versions_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_insert_policy ON public.plan_versions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plan_versions plan_versions_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_select_policy ON public.plan_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plan_versions plan_versions_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_update_policy ON public.plan_versions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: plans plans_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_delete_policy ON public.plans FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: plans plans_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_insert_policy ON public.plans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: plans plans_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_select_policy ON public.plans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: plans plans_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_update_policy ON public.plans FOR UPDATE USING ((auth.uid() = user_id));


--
-- PostgreSQL database dump complete
--


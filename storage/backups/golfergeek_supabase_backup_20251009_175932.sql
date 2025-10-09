--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


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
    workflow_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    synced_at timestamp with time zone DEFAULT now(),
    notes text,
    CONSTRAINT migration_metadata_source_check CHECK ((source = ANY (ARRAY['dev'::text, 'prod'::text, 'staging'::text])))
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
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true,
    nodes jsonb DEFAULT '[]'::jsonb NOT NULL,
    connections jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
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
-- Name: agent_orchestrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_orchestrations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_slug text,
    agent_slug text NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text,
    orchestration_json jsonb NOT NULL,
    prompt_templates jsonb DEFAULT '[]'::jsonb,
    tags text[] DEFAULT ARRAY[]::text[],
    version text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE agent_orchestrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_orchestrations IS 'Reusable orchestration recipes bound to a specific agent.';


--
-- Name: COLUMN agent_orchestrations.orchestration_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_orchestrations.orchestration_json IS 'Structured orchestration definition (phases, steps, dependencies).';


--
-- Name: COLUMN agent_orchestrations.prompt_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_orchestrations.prompt_templates IS 'Prompt templates with parameter metadata required to launch orchestrations.';


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
    agent_card jsonb,
    context jsonb,
    config jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    function_code text
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
-- Name: COLUMN agents.agent_card; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.agent_card IS 'Cached agent card served to clients.';


--
-- Name: COLUMN agents.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.context IS 'System prompt, plan rubric, and reference data.';


--
-- Name: COLUMN agents.config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.config IS 'Execution configuration (capabilities, supporting agents, checkpoints, etc.).';


--
-- Name: COLUMN agents.function_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.function_code IS 'JavaScript/TypeScript function code for function-type agents';


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
    ended_at timestamp with time zone
);


--
-- Name: COLUMN conversations.organization_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.organization_slug IS 'Organization slug for database agents (e.g., my-org, acme-corp). NULL for file-based agents.';


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
    progress_message text,
    error_code text,
    error_message text,
    error_data jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    timeout_seconds integer DEFAULT 300,
    deliverable_type text,
    deliverable_metadata jsonb,
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
    project_step_id uuid,
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
 SELECT (date_trunc('day'::text, llm_usage.started_at))::date AS date,
    COALESCE(llm_usage.caller_type, 'unknown'::text) AS caller_type,
    count(*) AS total_requests,
    sum(
        CASE
            WHEN (llm_usage.status = 'completed'::text) THEN 1
            ELSE 0
        END) AS successful_requests,
    COALESCE(sum(llm_usage.total_cost), sum((COALESCE(llm_usage.input_cost, (0)::numeric) + COALESCE(llm_usage.output_cost, (0)::numeric)))) AS total_cost,
    avg(COALESCE(llm_usage.duration_ms, 0)) AS avg_duration_ms,
    sum(
        CASE
            WHEN (llm_usage.is_local IS TRUE) THEN 1
            ELSE 0
        END) AS local_requests,
    sum(
        CASE
            WHEN (llm_usage.is_local IS NOT TRUE) THEN 1
            ELSE 0
        END) AS external_requests
   FROM public.llm_usage
  GROUP BY ((date_trunc('day'::text, llm_usage.started_at))::date), COALESCE(llm_usage.caller_type, 'unknown'::text)
  ORDER BY ((date_trunc('day'::text, llm_usage.started_at))::date) DESC, COALESCE(llm_usage.caller_type, 'unknown'::text);


--
-- Name: orchestration_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orchestration_runs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    plan_id uuid,
    origin_type text DEFAULT 'plan'::text,
    origin_id uuid,
    orchestration_slug text,
    prompt_inputs jsonb DEFAULT '{}'::jsonb,
    organization_slug text,
    status text DEFAULT 'pending'::text,
    current_step_index integer,
    completed_steps jsonb DEFAULT '[]'::jsonb,
    step_state jsonb DEFAULT '{}'::jsonb,
    human_checkpoint_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: TABLE orchestration_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.orchestration_runs IS 'Live orchestration execution state derived from conversation plans or saved orchestrations.';


--
-- Name: COLUMN orchestration_runs.origin_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orchestration_runs.origin_type IS 'Execution source (plan, saved_orchestration, ad_hoc).';


--
-- Name: COLUMN orchestration_runs.orchestration_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orchestration_runs.orchestration_slug IS 'Slug of the saved orchestration recipe when origin_type = saved_orchestration.';


--
-- Name: COLUMN orchestration_runs.prompt_inputs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orchestration_runs.prompt_inputs IS 'Resolved prompt parameter payload provided at orchestration launch.';


--
-- Name: COLUMN orchestration_runs.step_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orchestration_runs.step_state IS 'Per-step status metadata including conversations, deliverables, assignments.';


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
    plan_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    organization_slug text
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
-- Data for Name: companies; Type: TABLE DATA; Schema: company; Owner: -
--

COPY company.companies (id, name, industry, founded_year, created_at, updated_at) FROM stdin;
5ea464e8-9a64-453d-9c46-a6908b7e01ad	Acme Analytics Inc.	Software	2018	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: company; Owner: -
--

COPY company.departments (id, company_id, name, head_of_department, budget, created_at, updated_at) FROM stdin;
f74fdc4e-6a3b-4880-9558-8716b9671d01	5ea464e8-9a64-453d-9c46-a6908b7e01ad	Sales	\N	1000000.00	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
ce7d2204-b6cd-494c-9adf-8ebae0aa8262	5ea464e8-9a64-453d-9c46-a6908b7e01ad	Professional Services	\N	1000000.00	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
f0c47c0c-5944-492e-b604-59469f1633bb	5ea464e8-9a64-453d-9c46-a6908b7e01ad	Enterprise Accounts	\N	1000000.00	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: kpi_data; Type: TABLE DATA; Schema: company; Owner: -
--

COPY company.kpi_data (id, department_id, metric_id, value, date_recorded, created_at, updated_at) FROM stdin;
a350251a-0865-43bf-812b-64040d144208	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
c7a48dd5-7e0e-4453-b410-0eddb78ef1d5	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
6ecae517-83ef-4571-ba9d-9d52185bbe06	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
53fd1f61-ba13-4bed-ace3-af9e180bf833	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1097.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
3af43532-da72-4a5a-877f-9f436613914f	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	2097.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
2c619a53-a725-4b63-bd6d-435a9713df2d	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
9eb96801-d56f-46fd-aa1b-f2bc2456e157	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
fa60372b-aba9-42de-88b1-bc5bc0db4d48	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
43fe8134-fba8-42ba-8d21-4d4131124059	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1097.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
2c66854d-ec9d-46b1-b44a-578e12ca85d9	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	708be761-243b-4970-bffc-0f46a20b188d	2097.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
735c3210-6189-4ee0-8f4f-4dd12f007246	f0c47c0c-5944-492e-b604-59469f1633bb	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
4f36f59d-c846-4ede-bd03-5e7ee27848a9	f0c47c0c-5944-492e-b604-59469f1633bb	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
43c0df09-da59-41b4-9673-a6f2d2c06147	f0c47c0c-5944-492e-b604-59469f1633bb	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4597.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
057e5384-5e1a-4368-ba2f-4c6f7983f4fa	f0c47c0c-5944-492e-b604-59469f1633bb	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1097.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
1293e22f-fdc7-4935-a83e-a25c34db8470	f0c47c0c-5944-492e-b604-59469f1633bb	708be761-243b-4970-bffc-0f46a20b188d	2097.0000	2025-10-08	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d91d49c7-b6d7-458c-98cb-e880a87a45ba	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
09676ae4-b1cf-42d3-8a4b-96ea501c97ba	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
f89963db-962b-4b99-af3d-196953286c64	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
453b314d-cc98-4cdd-b806-017184e29b3e	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1194.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
77071353-cbad-4654-9ab4-ce067ee644bd	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	2194.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
f34fac78-358f-465a-aa70-7bc5132ca5b7	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
bbda0033-6741-4b5a-8f26-a1fed6bb6e14	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d2e4ade3-500d-45e7-9ebb-4d8c5563a55b	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
b4755561-00fb-4708-9495-7f01dbe5a022	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1194.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
2daea62b-af54-483f-a6c8-5030a2b9fa54	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	708be761-243b-4970-bffc-0f46a20b188d	2194.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
02b2681d-35ab-4b98-9a65-cf93d89ef9c3	f0c47c0c-5944-492e-b604-59469f1633bb	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
8ab37b3b-8ea7-4d81-97dc-dfc3e6e05eac	f0c47c0c-5944-492e-b604-59469f1633bb	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
1c57a66a-7998-4547-8e52-bf951e3a0c6b	f0c47c0c-5944-492e-b604-59469f1633bb	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4694.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
332785af-a054-413f-8d7e-107d424604e3	f0c47c0c-5944-492e-b604-59469f1633bb	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1194.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
0563d784-982f-45ae-8325-3bbd535386b7	f0c47c0c-5944-492e-b604-59469f1633bb	708be761-243b-4970-bffc-0f46a20b188d	2194.0000	2025-10-07	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d07a5ab4-fcb4-4921-ab39-385ab09c93cb	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
57a457a4-4c50-4f95-bef9-139a1603a994	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
e1dfab09-8b87-44de-86e6-c35b3ba21c6c	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
617179c7-1641-4d0c-93c9-7c44bbe35515	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1291.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
51a75758-f0b7-4c6c-a17e-bf0f91a384ae	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	2291.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
77d0f215-6a7d-4c7d-96b1-a2e830c1481b	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
9f42c48b-26fc-4abe-bea7-546df9b6322f	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
0ffebb0a-ea7e-4dd7-bbee-103ec8f4af83	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
036f8c46-dff2-45db-9ef3-d87d32fbbe83	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1291.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
18475936-2ab3-4ab2-9c88-ca8393cbde64	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	708be761-243b-4970-bffc-0f46a20b188d	2291.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
0002f562-9385-484e-9b99-a3cc90b7781b	f0c47c0c-5944-492e-b604-59469f1633bb	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
52101ccf-d274-4445-9464-0debbb0094a8	f0c47c0c-5944-492e-b604-59469f1633bb	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
fc3785f4-2b4f-4f21-8677-c4fba61fad82	f0c47c0c-5944-492e-b604-59469f1633bb	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4791.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
a4fd7a98-2989-4952-853e-92689ce04153	f0c47c0c-5944-492e-b604-59469f1633bb	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1291.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
2e40070e-4d9a-45ee-9161-adbe70e16165	f0c47c0c-5944-492e-b604-59469f1633bb	708be761-243b-4970-bffc-0f46a20b188d	2291.0000	2025-10-06	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
3c17d546-e1c0-4c4f-8173-9dab5f1c88c4	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
6719cd9b-8ab3-457c-820e-8b9fec78b2f1	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
07ae6178-188f-48e5-b974-3d1b3018b13a	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
21506812-ca3a-40b2-8b90-d21878dc7cd6	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1388.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
fcd78237-5615-4689-9052-cefa301bb31d	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	2388.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
8d81b0b5-43c8-422a-9d9f-0b2fa4d13814	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
e72467f1-faf8-4540-9323-29bf16a05fd1	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
f1d938db-ac23-46d3-a5b4-f2206e214e98	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d2cb82f4-d2a1-45a0-9fbf-91890f953841	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1388.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
87f7e449-aeef-450b-a841-ac5e52a5ea02	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	708be761-243b-4970-bffc-0f46a20b188d	2388.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
436fab49-57b0-424b-bb48-1877efccfe7b	f0c47c0c-5944-492e-b604-59469f1633bb	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
b50d1d6c-74c7-486b-80ba-4096de245706	f0c47c0c-5944-492e-b604-59469f1633bb	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
35c97ba1-86f6-4399-8e19-bc620900625b	f0c47c0c-5944-492e-b604-59469f1633bb	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4888.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
7eaabb43-5ca9-40e3-8718-6db68b4fa486	f0c47c0c-5944-492e-b604-59469f1633bb	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1388.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
54dee397-4a4f-4d91-8cee-056d5921cb23	f0c47c0c-5944-492e-b604-59469f1633bb	708be761-243b-4970-bffc-0f46a20b188d	2388.0000	2025-10-05	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
7dac0ddf-6088-48f0-a0ef-8ae54785a1cd	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
e6a5da7f-771b-4e43-9300-7e3781945d28	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
2a30d86c-5a98-4c96-a27d-31780cbc6b0d	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
075a757e-dedc-4a1a-b021-c53b89cd746a	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1485.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
c439e432-51cc-4589-ac0e-f83b7ac38fbb	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	2485.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
bf55c304-8900-4440-857f-0d64dd777891	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
55829b74-8567-48a5-87b9-c1ac61fb798b	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
760355a2-91b8-41d7-8ef4-2c1b595f3952	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
1e7faf7a-3634-4b02-a890-4bfda206a7d4	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1485.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
307c0457-68ce-466e-a3c1-216247b84d6f	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	708be761-243b-4970-bffc-0f46a20b188d	2485.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
61dcbc1d-f2a2-4909-9697-57141bf35f03	f0c47c0c-5944-492e-b604-59469f1633bb	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	14985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d08a0620-c562-40ba-bd46-05ab16a8cd9e	f0c47c0c-5944-492e-b604-59469f1633bb	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	7985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
b4ac4126-8d38-42be-b7ec-107e51e168dd	f0c47c0c-5944-492e-b604-59469f1633bb	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	4985.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
277d9e09-4d35-4d4d-bf92-71db582ba6f6	f0c47c0c-5944-492e-b604-59469f1633bb	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1485.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
df1dfe5b-7f6f-4944-8008-39a2c12d6f4a	f0c47c0c-5944-492e-b604-59469f1633bb	708be761-243b-4970-bffc-0f46a20b188d	2485.0000	2025-10-04	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
323455b5-19b9-4b58-a3de-a198a96a5d7b	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	15082.0000	2025-10-03	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
27b69907-ab31-4881-8dff-037fff7d0b94	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	8082.0000	2025-10-03	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
7660ba11-69d7-4a5b-8073-db8162d9147c	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	5082.0000	2025-10-03	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
1919c7d7-1650-4934-9597-f07d8a1eb88c	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	1582.0000	2025-10-03	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
372e5023-1141-4470-9e85-ef452c9b98e8	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	2582.0000	2025-10-03	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: kpi_goals; Type: TABLE DATA; Schema: company; Owner: -
--

COPY company.kpi_goals (id, department_id, metric_id, target_value, period_start, period_end, created_at, updated_at) FROM stdin;
52f5d36b-2243-499a-a93f-f0e7b2966941	f74fdc4e-6a3b-4880-9558-8716b9671d01	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	500000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
ee1f210a-a376-4094-9596-ccd788e0be91	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	500000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
bb68034e-3af0-4b73-96f4-5eda69abed4a	f0c47c0c-5944-492e-b604-59469f1633bb	d12bd211-7c3f-4434-baa2-46b89aa7f2d4	500000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
6cdbb058-7e84-4ce6-9847-45b6f9116cfe	f74fdc4e-6a3b-4880-9558-8716b9671d01	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	250000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d2d09f1f-8082-4e09-929b-499aa3a90d8e	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	250000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
fa13e4b6-aa45-4006-87cc-51dc69135b72	f0c47c0c-5944-492e-b604-59469f1633bb	cca4d9f2-271f-4c1d-bf84-09c3daf980bf	250000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d37e4e4d-d7bb-4473-8bd5-c90e619e7346	f74fdc4e-6a3b-4880-9558-8716b9671d01	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	150000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
e805ef0a-8b43-410b-9b44-0be2435edfd8	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	150000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
d3dbe723-1ce6-49df-a964-466ad3b81e4d	f0c47c0c-5944-492e-b604-59469f1633bb	6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	150000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
6198c700-603f-474a-b4bb-72dfeba1c813	f74fdc4e-6a3b-4880-9558-8716b9671d01	310398dc-1f31-4d5c-b172-7da2ecfd00c8	50000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
2ab74b6d-4f5b-4bf4-ae57-01849092697e	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	310398dc-1f31-4d5c-b172-7da2ecfd00c8	50000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
9e87a0b8-21ef-4187-862c-04f950984cd0	f0c47c0c-5944-492e-b604-59469f1633bb	310398dc-1f31-4d5c-b172-7da2ecfd00c8	50000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
38f3f08e-fffd-480b-be22-a5e728c4d96b	f74fdc4e-6a3b-4880-9558-8716b9671d01	708be761-243b-4970-bffc-0f46a20b188d	75000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
118fa70d-6c3d-4894-bf1d-a31553541bfb	ce7d2204-b6cd-494c-9adf-8ebae0aa8262	708be761-243b-4970-bffc-0f46a20b188d	75000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
8b9e0562-5815-4601-9846-7ce44f7bc68e	f0c47c0c-5944-492e-b604-59469f1633bb	708be761-243b-4970-bffc-0f46a20b188d	75000.0000	2025-10-01	2025-12-31	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: kpi_metrics; Type: TABLE DATA; Schema: company; Owner: -
--

COPY company.kpi_metrics (id, name, metric_type, unit, description, created_at, updated_at) FROM stdin;
d12bd211-7c3f-4434-baa2-46b89aa7f2d4	Revenue_Total	revenue	USD	Total revenue	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
cca4d9f2-271f-4c1d-bf84-09c3daf980bf	Revenue_Subscription	revenue	USD	Recurring subscription revenue	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
6e8e5d7d-0fab-4ce2-9f49-a5f451fbdb8b	Revenue_Services	revenue	USD	Professional services revenue	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
310398dc-1f31-4d5c-b172-7da2ecfd00c8	Revenue_Usage	revenue	USD	Usage-based revenue	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
708be761-243b-4970-bffc-0f46a20b188d	Revenue_Enterprise	revenue	USD	Enterprise contract revenue	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: annotation_tag_entity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.annotation_tag_entity (id, name, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: auth_identity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.auth_identity ("userId", "providerId", "providerType", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: auth_provider_sync_history; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.auth_provider_sync_history (id, "providerType", "runMode", status, "startedAt", "endedAt", scanned, created, updated, disabled, error) FROM stdin;
\.


--
-- Data for Name: credentials_entity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.credentials_entity (name, data, type, "createdAt", "updatedAt", id, "isManaged") FROM stdin;
\.


--
-- Data for Name: data_table; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.data_table (id, name, "projectId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: data_table_column; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.data_table_column (id, name, type, index, "dataTableId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: event_destinations; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.event_destinations (id, destination, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: execution_annotation_tags; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.execution_annotation_tags ("annotationId", "tagId") FROM stdin;
\.


--
-- Data for Name: execution_annotations; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.execution_annotations (id, "executionId", vote, note, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: execution_data; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.execution_data ("executionId", "workflowData", data) FROM stdin;
\.


--
-- Data for Name: execution_entity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.execution_entity (id, finished, mode, "retryOf", "retrySuccessId", "startedAt", "stoppedAt", "waitTill", status, "workflowId", "deletedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: execution_metadata; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.execution_metadata (id, "executionId", key, value) FROM stdin;
\.


--
-- Data for Name: folder; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.folder (id, name, "parentFolderId", "projectId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: folder_tag; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.folder_tag ("folderId", "tagId") FROM stdin;
\.


--
-- Data for Name: insights_by_period; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.insights_by_period (id, "metaId", type, value, "periodUnit", "periodStart") FROM stdin;
\.


--
-- Data for Name: insights_metadata; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.insights_metadata ("metaId", "workflowId", "projectId", "workflowName", "projectName") FROM stdin;
\.


--
-- Data for Name: insights_raw; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.insights_raw (id, "metaId", type, value, "timestamp") FROM stdin;
\.


--
-- Data for Name: installed_nodes; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.installed_nodes (name, type, "latestVersion", package) FROM stdin;
\.


--
-- Data for Name: installed_packages; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.installed_packages ("packageName", "installedVersion", "authorName", "authorEmail", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: invalid_auth_token; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.invalid_auth_token (token, "expiresAt") FROM stdin;
\.


--
-- Data for Name: migration_metadata; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.migration_metadata (migration_file, source, workflow_id, created_at, synced_at, notes) FROM stdin;
20251007190433_add_n8n_marketing_swarm_major_announcement.sql	dev	ee248b9d-f72d-40a0-8c26-6dbfaef5368a	2025-10-09 19:18:09.93636+00	2025-10-09 19:18:09.93636+00	Exported from n8n API
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.migrations (id, "timestamp", name) FROM stdin;
1	1587669153312	InitialMigration1587669153312
2	1589476000887	WebhookModel1589476000887
3	1594828256133	CreateIndexStoppedAt1594828256133
4	1607431743768	MakeStoppedAtNullable1607431743768
5	1611144599516	AddWebhookId1611144599516
6	1617270242566	CreateTagEntity1617270242566
7	1620824779533	UniqueWorkflowNames1620824779533
8	1626176912946	AddwaitTill1626176912946
9	1630419189837	UpdateWorkflowCredentials1630419189837
10	1644422880309	AddExecutionEntityIndexes1644422880309
11	1646834195327	IncreaseTypeVarcharLimit1646834195327
12	1646992772331	CreateUserManagement1646992772331
13	1648740597343	LowerCaseUserEmail1648740597343
14	1652254514002	CommunityNodes1652254514002
15	1652367743993	AddUserSettings1652367743993
16	1652905585850	AddAPIKeyColumn1652905585850
17	1654090467022	IntroducePinData1654090467022
18	1658932090381	AddNodeIds1658932090381
19	1659902242948	AddJsonKeyPinData1659902242948
20	1660062385367	CreateCredentialsUserRole1660062385367
21	1663755770893	CreateWorkflowsEditorRole1663755770893
22	1664196174001	WorkflowStatistics1664196174001
23	1665484192212	CreateCredentialUsageTable1665484192212
24	1665754637025	RemoveCredentialUsageTable1665754637025
25	1669739707126	AddWorkflowVersionIdColumn1669739707126
26	1669823906995	AddTriggerCountColumn1669823906995
27	1671535397530	MessageEventBusDestinations1671535397530
28	1671726148421	RemoveWorkflowDataLoadedFlag1671726148421
29	1673268682475	DeleteExecutionsWithWorkflows1673268682475
30	1674138566000	AddStatusToExecutions1674138566000
31	1674509946020	CreateLdapEntities1674509946020
32	1675940580449	PurgeInvalidWorkflowConnections1675940580449
33	1676996103000	MigrateExecutionStatus1676996103000
34	1677236854063	UpdateRunningExecutionStatus1677236854063
35	1677501636754	CreateVariables1677501636754
36	1679416281778	CreateExecutionMetadataTable1679416281778
37	1681134145996	AddUserActivatedProperty1681134145996
38	1681134145997	RemoveSkipOwnerSetup1681134145997
39	1690000000000	MigrateIntegerKeysToString1690000000000
40	1690000000020	SeparateExecutionData1690000000020
41	1690000000030	RemoveResetPasswordColumns1690000000030
42	1690000000030	AddMfaColumns1690000000030
43	1690787606731	AddMissingPrimaryKeyOnExecutionData1690787606731
44	1691088862123	CreateWorkflowNameIndex1691088862123
45	1692967111175	CreateWorkflowHistoryTable1692967111175
46	1693491613982	ExecutionSoftDelete1693491613982
47	1693554410387	DisallowOrphanExecutions1693554410387
48	1694091729095	MigrateToTimestampTz1694091729095
49	1695128658538	AddWorkflowMetadata1695128658538
50	1695829275184	ModifyWorkflowHistoryNodesAndConnections1695829275184
51	1700571993961	AddGlobalAdminRole1700571993961
52	1705429061930	DropRoleMapping1705429061930
53	1711018413374	RemoveFailedExecutionStatus1711018413374
54	1711390882123	MoveSshKeysToDatabase1711390882123
55	1712044305787	RemoveNodesAccess1712044305787
56	1714133768519	CreateProject1714133768519
57	1714133768521	MakeExecutionStatusNonNullable1714133768521
58	1717498465931	AddActivatedAtUserSetting1717498465931
59	1720101653148	AddConstraintToExecutionMetadata1720101653148
60	1721377157740	FixExecutionMetadataSequence1721377157740
61	1723627610222	CreateInvalidAuthTokenTable1723627610222
62	1723796243146	RefactorExecutionIndices1723796243146
63	1724753530828	CreateAnnotationTables1724753530828
64	1724951148974	AddApiKeysTable1724951148974
65	1726606152711	CreateProcessedDataTable1726606152711
66	1727427440136	SeparateExecutionCreationFromStart1727427440136
67	1728659839644	AddMissingPrimaryKeyOnAnnotationTagMapping1728659839644
68	1729607673464	UpdateProcessedDataValueColumnToText1729607673464
69	1729607673469	AddProjectIcons1729607673469
70	1730386903556	CreateTestDefinitionTable1730386903556
71	1731404028106	AddDescriptionToTestDefinition1731404028106
72	1731582748663	MigrateTestDefinitionKeyToString1731582748663
73	1732271325258	CreateTestMetricTable1732271325258
74	1732549866705	CreateTestRun1732549866705
75	1733133775640	AddMockedNodesColumnToTestDefinition1733133775640
76	1734479635324	AddManagedColumnToCredentialsTable1734479635324
77	1736172058779	AddStatsColumnsToTestRun1736172058779
78	1736947513045	CreateTestCaseExecutionTable1736947513045
79	1737715421462	AddErrorColumnsToTestRuns1737715421462
80	1738709609940	CreateFolderTable1738709609940
81	1739549398681	CreateAnalyticsTables1739549398681
82	1740445074052	UpdateParentFolderIdColumn1740445074052
83	1741167584277	RenameAnalyticsToInsights1741167584277
84	1742918400000	AddScopesColumnToApiKeys1742918400000
85	1745322634000	ClearEvaluation1745322634000
86	1745587087521	AddWorkflowStatisticsRootCount1745587087521
87	1745934666076	AddWorkflowArchivedColumn1745934666076
88	1745934666077	DropRoleTable1745934666077
89	1747824239000	AddProjectDescriptionColumn1747824239000
90	1750252139166	AddLastActiveAtColumnToUser1750252139166
91	1750252139166	AddScopeTables1750252139166
92	1750252139167	AddRolesTables1750252139167
93	1750252139168	LinkRoleToUserTable1750252139168
94	1750252139170	RemoveOldRoleColumn1750252139170
95	1752669793000	AddInputsOutputsToTestCaseExecution1752669793000
96	1753953244168	LinkRoleToProjectRelationTable1753953244168
97	1754475614601	CreateDataStoreTables1754475614601
98	1754475614602	ReplaceDataStoreTablesWithDataTables1754475614602
99	1756906557570	AddTimestampsToRoleAndRoleIndexes1756906557570
\.


--
-- Data for Name: n8n_workflows; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.n8n_workflows (id, name, active, nodes, connections, settings, created_at, updated_at) FROM stdin;
ee248b9d-f72d-40a0-8c26-6dbfaef5368a	Marketing Swarm - Major Announcement	t	[{"id": "webhook", "name": "Webhook Trigger", "type": "n8n-nodes-base.webhook", "position": [112, 112], "webhookId": "7f338c6b-a9bb-446b-9a1d-702739d89a51", "parameters": {"path": "marketing-swarm", "options": {}, "httpMethod": "POST", "responseMode": "responseNode"}, "typeVersion": 2}]	{}	{}	2025-10-09 19:18:09.93636+00	2025-10-09 19:18:09.93636+00
\.


--
-- Data for Name: processed_data; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.processed_data ("workflowId", context, "createdAt", "updatedAt", value) FROM stdin;
\.


--
-- Data for Name: project; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.project (id, name, type, "createdAt", "updatedAt", icon, description) FROM stdin;
i9Hx3voRXPvZMWtL	Golfer Geek <golfergeek@orchestratorai.io>	personal	2025-10-09 20:29:48.678+00	2025-10-09 20:45:39.243+00	\N	\N
\.


--
-- Data for Name: project_relation; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.project_relation ("projectId", "userId", role, "createdAt", "updatedAt") FROM stdin;
i9Hx3voRXPvZMWtL	9f12b0ff-372b-4d46-b8ea-30c14a4a14a2	project:personalOwner	2025-10-09 20:29:48.678+00	2025-10-09 20:29:48.678+00
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.role (slug, "displayName", description, "roleType", "systemRole", "createdAt", "updatedAt") FROM stdin;
global:owner	Owner	Owner	global	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.285+00
global:admin	Admin	Admin	global	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.285+00
global:member	Member	Member	global	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.285+00
project:admin	Project Admin	Project Admin	project	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.301+00
project:personalOwner	Project Owner	Project Owner	project	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.301+00
project:editor	Project Editor	Project Editor	project	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.301+00
project:viewer	Project Viewer	Project Viewer	project	t	2025-10-09 20:29:49.222+00	2025-10-09 20:29:49.301+00
credential:owner	Credential Owner	Credential Owner	credential	t	2025-10-09 20:29:49.31+00	2025-10-09 20:29:49.31+00
credential:user	Credential User	Credential User	credential	t	2025-10-09 20:29:49.31+00	2025-10-09 20:29:49.31+00
workflow:owner	Workflow Owner	Workflow Owner	workflow	t	2025-10-09 20:29:49.315+00	2025-10-09 20:29:49.315+00
workflow:editor	Workflow Editor	Workflow Editor	workflow	t	2025-10-09 20:29:49.315+00	2025-10-09 20:29:49.315+00
\.


--
-- Data for Name: role_scope; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.role_scope ("roleSlug", "scopeSlug") FROM stdin;
global:owner	annotationTag:create
global:owner	annotationTag:read
global:owner	annotationTag:update
global:owner	annotationTag:delete
global:owner	annotationTag:list
global:owner	auditLogs:manage
global:owner	banner:dismiss
global:owner	community:register
global:owner	communityPackage:install
global:owner	communityPackage:uninstall
global:owner	communityPackage:update
global:owner	communityPackage:list
global:owner	credential:share
global:owner	credential:move
global:owner	credential:create
global:owner	credential:read
global:owner	credential:update
global:owner	credential:delete
global:owner	credential:list
global:owner	externalSecretsProvider:sync
global:owner	externalSecretsProvider:create
global:owner	externalSecretsProvider:read
global:owner	externalSecretsProvider:update
global:owner	externalSecretsProvider:delete
global:owner	externalSecretsProvider:list
global:owner	externalSecret:list
global:owner	externalSecret:use
global:owner	eventBusDestination:test
global:owner	eventBusDestination:create
global:owner	eventBusDestination:read
global:owner	eventBusDestination:update
global:owner	eventBusDestination:delete
global:owner	eventBusDestination:list
global:owner	ldap:sync
global:owner	ldap:manage
global:owner	license:manage
global:owner	logStreaming:manage
global:owner	orchestration:read
global:owner	project:create
global:owner	project:read
global:owner	project:update
global:owner	project:delete
global:owner	project:list
global:owner	saml:manage
global:owner	securityAudit:generate
global:owner	sourceControl:pull
global:owner	sourceControl:push
global:owner	sourceControl:manage
global:owner	tag:create
global:owner	tag:read
global:owner	tag:update
global:owner	tag:delete
global:owner	tag:list
global:owner	user:resetPassword
global:owner	user:changeRole
global:owner	user:enforceMfa
global:owner	user:create
global:owner	user:read
global:owner	user:update
global:owner	user:delete
global:owner	user:list
global:owner	variable:create
global:owner	variable:read
global:owner	variable:update
global:owner	variable:delete
global:owner	variable:list
global:owner	workersView:manage
global:owner	workflow:share
global:owner	workflow:execute
global:owner	workflow:move
global:owner	workflow:create
global:owner	workflow:read
global:owner	workflow:update
global:owner	workflow:delete
global:owner	workflow:list
global:owner	folder:create
global:owner	folder:read
global:owner	folder:update
global:owner	folder:delete
global:owner	folder:list
global:owner	folder:move
global:owner	insights:list
global:owner	oidc:manage
global:owner	dataStore:list
global:owner	role:manage
global:admin	annotationTag:create
global:admin	annotationTag:read
global:admin	annotationTag:update
global:admin	annotationTag:delete
global:admin	annotationTag:list
global:admin	auditLogs:manage
global:admin	banner:dismiss
global:admin	community:register
global:admin	communityPackage:install
global:admin	communityPackage:uninstall
global:admin	communityPackage:update
global:admin	communityPackage:list
global:admin	credential:share
global:admin	credential:move
global:admin	credential:create
global:admin	credential:read
global:admin	credential:update
global:admin	credential:delete
global:admin	credential:list
global:admin	externalSecretsProvider:sync
global:admin	externalSecretsProvider:create
global:admin	externalSecretsProvider:read
global:admin	externalSecretsProvider:update
global:admin	externalSecretsProvider:delete
global:admin	externalSecretsProvider:list
global:admin	externalSecret:list
global:admin	externalSecret:use
global:admin	eventBusDestination:test
global:admin	eventBusDestination:create
global:admin	eventBusDestination:read
global:admin	eventBusDestination:update
global:admin	eventBusDestination:delete
global:admin	eventBusDestination:list
global:admin	ldap:sync
global:admin	ldap:manage
global:admin	license:manage
global:admin	logStreaming:manage
global:admin	orchestration:read
global:admin	project:create
global:admin	project:read
global:admin	project:update
global:admin	project:delete
global:admin	project:list
global:admin	saml:manage
global:admin	securityAudit:generate
global:admin	sourceControl:pull
global:admin	sourceControl:push
global:admin	sourceControl:manage
global:admin	tag:create
global:admin	tag:read
global:admin	tag:update
global:admin	tag:delete
global:admin	tag:list
global:admin	user:resetPassword
global:admin	user:changeRole
global:admin	user:enforceMfa
global:admin	user:create
global:admin	user:read
global:admin	user:update
global:admin	user:delete
global:admin	user:list
global:admin	variable:create
global:admin	variable:read
global:admin	variable:update
global:admin	variable:delete
global:admin	variable:list
global:admin	workersView:manage
global:admin	workflow:share
global:admin	workflow:execute
global:admin	workflow:move
global:admin	workflow:create
global:admin	workflow:read
global:admin	workflow:update
global:admin	workflow:delete
global:admin	workflow:list
global:admin	folder:create
global:admin	folder:read
global:admin	folder:update
global:admin	folder:delete
global:admin	folder:list
global:admin	folder:move
global:admin	insights:list
global:admin	oidc:manage
global:admin	dataStore:list
global:admin	role:manage
global:member	annotationTag:create
global:member	annotationTag:read
global:member	annotationTag:update
global:member	annotationTag:delete
global:member	annotationTag:list
global:member	eventBusDestination:test
global:member	eventBusDestination:list
global:member	tag:create
global:member	tag:read
global:member	tag:update
global:member	tag:list
global:member	user:list
global:member	variable:read
global:member	variable:list
global:member	dataStore:list
project:admin	credential:share
project:admin	credential:move
project:admin	credential:create
project:admin	credential:read
project:admin	credential:update
project:admin	credential:delete
project:admin	credential:list
project:admin	project:read
project:admin	project:update
project:admin	project:delete
project:admin	project:list
project:admin	sourceControl:push
project:admin	workflow:execute
project:admin	workflow:move
project:admin	workflow:create
project:admin	workflow:read
project:admin	workflow:update
project:admin	workflow:delete
project:admin	workflow:list
project:admin	folder:create
project:admin	folder:read
project:admin	folder:update
project:admin	folder:delete
project:admin	folder:list
project:admin	folder:move
project:admin	dataStore:create
project:admin	dataStore:read
project:admin	dataStore:update
project:admin	dataStore:delete
project:admin	dataStore:readRow
project:admin	dataStore:writeRow
project:admin	dataStore:listProject
project:personalOwner	credential:share
project:personalOwner	credential:move
project:personalOwner	credential:create
project:personalOwner	credential:read
project:personalOwner	credential:update
project:personalOwner	credential:delete
project:personalOwner	credential:list
project:personalOwner	project:read
project:personalOwner	project:list
project:personalOwner	workflow:share
project:personalOwner	workflow:execute
project:personalOwner	workflow:move
project:personalOwner	workflow:create
project:personalOwner	workflow:read
project:personalOwner	workflow:update
project:personalOwner	workflow:delete
project:personalOwner	workflow:list
project:personalOwner	folder:create
project:personalOwner	folder:read
project:personalOwner	folder:update
project:personalOwner	folder:delete
project:personalOwner	folder:list
project:personalOwner	folder:move
project:personalOwner	dataStore:create
project:personalOwner	dataStore:read
project:personalOwner	dataStore:update
project:personalOwner	dataStore:delete
project:personalOwner	dataStore:readRow
project:personalOwner	dataStore:writeRow
project:personalOwner	dataStore:listProject
project:editor	credential:create
project:editor	credential:read
project:editor	credential:update
project:editor	credential:delete
project:editor	credential:list
project:editor	project:read
project:editor	project:list
project:editor	workflow:execute
project:editor	workflow:create
project:editor	workflow:read
project:editor	workflow:update
project:editor	workflow:delete
project:editor	workflow:list
project:editor	folder:create
project:editor	folder:read
project:editor	folder:update
project:editor	folder:delete
project:editor	folder:list
project:editor	dataStore:create
project:editor	dataStore:read
project:editor	dataStore:update
project:editor	dataStore:delete
project:editor	dataStore:readRow
project:editor	dataStore:writeRow
project:editor	dataStore:listProject
project:viewer	credential:read
project:viewer	credential:list
project:viewer	project:read
project:viewer	project:list
project:viewer	workflow:read
project:viewer	workflow:list
project:viewer	folder:read
project:viewer	folder:list
project:viewer	dataStore:read
project:viewer	dataStore:readRow
project:viewer	dataStore:listProject
credential:owner	credential:share
credential:owner	credential:move
credential:owner	credential:read
credential:owner	credential:update
credential:owner	credential:delete
credential:user	credential:read
workflow:owner	workflow:share
workflow:owner	workflow:execute
workflow:owner	workflow:move
workflow:owner	workflow:read
workflow:owner	workflow:update
workflow:owner	workflow:delete
workflow:editor	workflow:execute
workflow:editor	workflow:read
workflow:editor	workflow:update
\.


--
-- Data for Name: scope; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.scope (slug, "displayName", description) FROM stdin;
annotationTag:create	Create Annotation Tag	Allows creating new annotation tags.
annotationTag:read	annotationTag:read	\N
annotationTag:update	annotationTag:update	\N
annotationTag:delete	annotationTag:delete	\N
annotationTag:list	annotationTag:list	\N
annotationTag:*	annotationTag:*	\N
auditLogs:manage	auditLogs:manage	\N
auditLogs:*	auditLogs:*	\N
banner:dismiss	banner:dismiss	\N
banner:*	banner:*	\N
community:register	community:register	\N
community:*	community:*	\N
communityPackage:install	communityPackage:install	\N
communityPackage:uninstall	communityPackage:uninstall	\N
communityPackage:update	communityPackage:update	\N
communityPackage:list	communityPackage:list	\N
communityPackage:manage	communityPackage:manage	\N
communityPackage:*	communityPackage:*	\N
credential:share	credential:share	\N
credential:move	credential:move	\N
credential:create	credential:create	\N
credential:read	credential:read	\N
credential:update	credential:update	\N
credential:delete	credential:delete	\N
credential:list	credential:list	\N
credential:*	credential:*	\N
externalSecretsProvider:sync	externalSecretsProvider:sync	\N
externalSecretsProvider:create	externalSecretsProvider:create	\N
externalSecretsProvider:read	externalSecretsProvider:read	\N
externalSecretsProvider:update	externalSecretsProvider:update	\N
externalSecretsProvider:delete	externalSecretsProvider:delete	\N
externalSecretsProvider:list	externalSecretsProvider:list	\N
externalSecretsProvider:*	externalSecretsProvider:*	\N
externalSecret:list	externalSecret:list	\N
externalSecret:use	externalSecret:use	\N
externalSecret:*	externalSecret:*	\N
eventBusDestination:test	eventBusDestination:test	\N
eventBusDestination:create	eventBusDestination:create	\N
eventBusDestination:read	eventBusDestination:read	\N
eventBusDestination:update	eventBusDestination:update	\N
eventBusDestination:delete	eventBusDestination:delete	\N
eventBusDestination:list	eventBusDestination:list	\N
eventBusDestination:*	eventBusDestination:*	\N
ldap:sync	ldap:sync	\N
ldap:manage	ldap:manage	\N
ldap:*	ldap:*	\N
license:manage	license:manage	\N
license:*	license:*	\N
logStreaming:manage	logStreaming:manage	\N
logStreaming:*	logStreaming:*	\N
orchestration:read	orchestration:read	\N
orchestration:list	orchestration:list	\N
orchestration:*	orchestration:*	\N
project:create	project:create	\N
project:read	project:read	\N
project:update	project:update	\N
project:delete	project:delete	\N
project:list	project:list	\N
project:*	project:*	\N
saml:manage	saml:manage	\N
saml:*	saml:*	\N
securityAudit:generate	securityAudit:generate	\N
securityAudit:*	securityAudit:*	\N
sourceControl:pull	sourceControl:pull	\N
sourceControl:push	sourceControl:push	\N
sourceControl:manage	sourceControl:manage	\N
sourceControl:*	sourceControl:*	\N
tag:create	tag:create	\N
tag:read	tag:read	\N
tag:update	tag:update	\N
tag:delete	tag:delete	\N
tag:list	tag:list	\N
tag:*	tag:*	\N
user:resetPassword	user:resetPassword	\N
user:changeRole	user:changeRole	\N
user:enforceMfa	user:enforceMfa	\N
user:create	user:create	\N
user:read	user:read	\N
user:update	user:update	\N
user:delete	user:delete	\N
user:list	user:list	\N
user:*	user:*	\N
variable:create	variable:create	\N
variable:read	variable:read	\N
variable:update	variable:update	\N
variable:delete	variable:delete	\N
variable:list	variable:list	\N
variable:*	variable:*	\N
workersView:manage	workersView:manage	\N
workersView:*	workersView:*	\N
workflow:share	workflow:share	\N
workflow:execute	workflow:execute	\N
workflow:move	workflow:move	\N
workflow:activate	workflow:activate	\N
workflow:deactivate	workflow:deactivate	\N
workflow:create	workflow:create	\N
workflow:read	workflow:read	\N
workflow:update	workflow:update	\N
workflow:delete	workflow:delete	\N
workflow:list	workflow:list	\N
workflow:*	workflow:*	\N
folder:create	folder:create	\N
folder:read	folder:read	\N
folder:update	folder:update	\N
folder:delete	folder:delete	\N
folder:list	folder:list	\N
folder:move	folder:move	\N
folder:*	folder:*	\N
insights:list	insights:list	\N
insights:*	insights:*	\N
oidc:manage	oidc:manage	\N
oidc:*	oidc:*	\N
dataStore:create	dataStore:create	\N
dataStore:read	dataStore:read	\N
dataStore:update	dataStore:update	\N
dataStore:delete	dataStore:delete	\N
dataStore:list	dataStore:list	\N
dataStore:readRow	dataStore:readRow	\N
dataStore:writeRow	dataStore:writeRow	\N
dataStore:listProject	dataStore:listProject	\N
dataStore:*	dataStore:*	\N
execution:delete	execution:delete	\N
execution:read	execution:read	\N
execution:retry	execution:retry	\N
execution:list	execution:list	\N
execution:get	execution:get	\N
execution:*	execution:*	\N
workflowTags:update	workflowTags:update	\N
workflowTags:list	workflowTags:list	\N
workflowTags:*	workflowTags:*	\N
role:manage	role:manage	\N
role:*	role:*	\N
*	*	\N
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.settings (key, value, "loadOnStartup") FROM stdin;
ui.banners.dismissed	["V1"]	t
features.ldap	{"loginEnabled":false,"loginLabel":"","connectionUrl":"","allowUnauthorizedCerts":false,"connectionSecurity":"none","connectionPort":389,"baseDn":"","bindingAdminDn":"","bindingAdminPassword":"","firstNameAttribute":"","lastNameAttribute":"","emailAttribute":"","loginIdAttribute":"","ldapIdAttribute":"","userFilter":"","synchronizationEnabled":false,"synchronizationInterval":60,"searchPageSize":0,"searchTimeout":60}	t
userManagement.authenticationMethod	email	t
features.sourceControl.sshKeys	{"encryptedPrivateKey":"U2FsdGVkX18uK1cYPYc2Qqvf+aKSdY6oHbf5l0BCwR6cf7koIhxfqGl+fjXlNo08E0mNGYTUYMEfXX1oTf0cri5avihshJrZjx4I4bkSM3G7jG38t/k257KVEnBTkzPYkHHgNMS2PuYEirq08jIo83eUjJzec55QRDMAAb0qrQz5qnvBcxAyXRjkWwbQIK6LM8BNBKOLhHNXuiN5fCqHmru+RMY36gzX1B/z3tfvU575nAvKItVy9C5AR9YqeuGuSyFbtvxHVyaOhnM7guVg8nm0pHZoTR548mbIcRX4yYHwAYBpC2RWa6KT0PqdRDufoEGcD6ODbbmJHCcN7673B5XCkoj6XbNLLKBAu1d+0YPAzZWQq7/Z2pk3iHrlNWMpmcYOnxa8IIjeXO2AsdNlhhsrPs8OUTnCVslRGh8Eugee9SQpeCYhkGauFl1Mich0NCWCFc8j6ZTve4RN4rLLVGk9XrKfq5qSC8DfNStQPbM32ZFZXB0MMWWusOtFEkFUjQncmgHQo+kHZTQqtQrS5nI/RzxGMi/t4XGN4WIwP/EwmC4VtxrWTn9E6oH0KKJr","publicKey":"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPOfUCG5hekveeuBOAeFv0t01F7srLLyVCFZA3gmZ2Gm n8n deploy key"}	t
features.sourceControl	{"branchName":"main","keyGeneratorType":"ed25519"}	t
userManagement.isInstanceOwnerSetUp	true	t
license.cert	eyJsaWNlbnNlS2V5IjoiLS0tLS1CRUdJTiBMSUNFTlNFIEtFWS0tLS0tXG5MVFJaSUUwaHVKUWl0VzNXRElEWUlxSmdCYXZNT0VtRjk2TVY4TFhrYm1zTTB0YWZQS1hNdGE2MEJWTk9VVTNzXG5NWWhSa21oZy9rOWFNYWtseS91aGVmS3hDaC9PSWhNNkYwTG9Ydm12cCtINHZHK0hYNWtnbHFIak1ERm9QUTZwXG5BUVlJajVwSnpGVnVSSTZTK1lUMHltcW5zeTJUaSt3NExpa2hTM2NPUG9DUFNKRnVqc2tBREl4emRrSDgxUWtRXG5ZRUMycHNOSkx5L05uckdpVks2MnRrNWZEdzZlSzhBZHRwU1RYeGoxTHJ2NDNWVGlPUmkxMG14UGkydjFIbUtzXG50RW9SMks0aVUwOGxXRFM4cUJqdUhINEw0UXFvamFaeDl5dW9idUNzTG1QY1FEOEJsck1KcU9MT0RGeXZBaURHXG5oTko4VkZvRmlpTkN5V3JwV2JyU0l3PT18fFUyRnNkR1ZrWDE4dTdDMTYwSkdScG42SHFaaUZyK28rdHFRMHdDXG55TEtTamF6Q251bk1EUWYwdU1SNFRnTTZqSTF2WUlWWUFtRlFyMXA4VGlzdGpqckMrMnBMZTArNG1nZjRxVnlvXG53TGFpbjJXSHB0ckdwdXUrbSszSGUrNE1EQ2NDZzNPa0JwMXlNSTZZR0VtbXhONnNHTEVyM2FNQ2F2NGF5aGRCXG5nRjN4ZlQwWVk4WmQ2Z3cxa3pUaXF3d2J4bWs5VHM5RGlsQy9uczVxd3NlQXYybWZlczhXSHpiUDBoejhTbVVUXG5EaVlVUjJyYkNMQnk0ZGl6RjFtMkgyY1o2SGtZeFpGUlZjU05NekF0aEc5emNOVThWRWZ3RXFSME9XR2w2Y0kwXG5pYWZLM2NrM2YrRXg2VzlCNmJPME9Xbi9scVFPZ3p1YTYxaXFwQVdtVXRWTDBHUWhPa01EMnpOY3VDWFVlSDQ5XG5JbkVMb3k5bDhzM0ZjTExUZW5LUDFXUjFTYTZScjg1UEhHY1BKTk4yT0Z6WTFsV0c2YVF3aEliQVZWRk8zdm5mXG50WHBvTkoyY3FOOW9BNWptRkRtdE1mQzNxSmpST0d2Q0ZnZkZ0STFDYXA4dllFR2JYb0V0T3hhckJ4WGtTeHBpXG5rTFhZQ2IvQW5hckwrN2FqMStvRDVXL0NvMHRKbzg4UHlEUzgrNXJQOWd5TVoyUFMzWkx6VTVFZjBrOTFzdjBuXG5wSG1iS1lTUWx3S0JSZUdONEV1cy81Q1MvVzJ5NE8rMkpETEZZRUtYbSt4bUVzK21xa2tTanNGbmlNZ1V2N2pOXG5mSjFpTy9tL1RDTDh1ODdlRitleExxZjg4a1dVZ3d1dmFHMzlmb215ZU9rUGRyTjArdUJHSHpWWVhwVDF4SzBkXG5sZUJERjJDckhTSmxPU2U5OGU1L3NLWEdQY0tNMGNXeTdGWXJpZjhkSzRqZkNFVG1BUVU5Wk9nRG94dlQ5RzUxXG4vTGxjbGtnQmxudzFKa0l6S1JFcGp4T3MxTVk3K2Z1WXhTV1E3dERFR0xPWUpJWkRlWVpFc2IyTXF3OHNjUHdLXG5TanZJYitPd1R1SmZGN0NZakdvTEJjQmdkaVFzcERmUzZNdUd4a0dsUHo2ZmgxSHFSZHhldkFJbWUwV0VJT0VCXG4reTRZMVg4WFZCb05FN1NmQnFtQnVOZ0dOU3RmOHFOL2VKdGpyOXdyZEVJbjFUcXFSOFhEcnNManFmdlUvZmxuXG5NQ1I0RS9LQXI5YXF1Q21ndDJJWHFlaEZ3ZDlxVlJ4Snh4RjA1eVhsV01wejJTS2hSRTVIZ2QwcjNUS0lHWDNqXG5xYUVhRCs3VGt1WnRuc01DMXFRZEdtYjY3bHNlUnF5RXlBc2lHdmZUY2RxeU1MMklmNGZic2xKS0hRTXlMR3ZxXG4yV0NKQWI3VEIxSnl5aEVxTTRGL01XU1A1NlR4NHRTbmVSZlVscm9tMmdCOGMzR0NCb09CVWgvMm4xTlBydVgzXG5zUS9pZUlqVE1qTEphOU1RZlJic1JiVkJpOUh3M0R3dEVteEVjeUlmelQzUmxvMHBrWjB3S1hhL3p5YjVIa0RvXG4waHBFOEE5NDREQVMvdWxiL3BoVWlrZGg3VHd2U2lFTmhMelhjeVhWY3NqcE13Y0pSY2FxakJCK0pLSGxlTGNoXG5UckdaaSs2Wmc5OEphWjVuTDQ5RERacEgxU3FxdTV3bWgyOEIwc0hJYnZENmJqcVJNdFRsSExPaXFEMkoxWFpLXG5EQmR2S0RPYmhZOG4vWElKTStQbmIzY2lQcUNoZUJNWCtvb1VaZEVNWmRLK3l4blNqT09WWDBFckUyUzdiOWJJXG5ZeUVBeG5qQmVaQjYxdi9oOGpVUmV6Q1huTnd5bjFLSWtrLy9IMWRFbDdqeHpZaXUrbjV0eTI3RTI2T3EzdnpDXG5FcVdRRmlGY0xyWWNLK2kzM2dMR2VwYkJmUStTdmhXZndvRHU0N3R4Y1VOQkprc2pROWlhUHlISSt3TXlXamVkXG5JRm1RdWlLcG1sdG9RZEhNT3NIQnJ1SkpnbVFSN09ZRXErQW1wd3VhRUdRT0JaTUdUcmlBNm9mYkMxR09UVzFNXG42aThWKzB5SmJQUWV3SzdVa2Vsc1R3U2hwZ1RSK01Ba21UaHlaaDBURWR1T1ZrNTI0SHZPR3pTc0ozMU9NeW80XG43WkxkU3JzSFl1UXAwNjEySEFzZTRDUmttUGdkemtSMGc1RVZaRXdBZys1cjNOVC9VenpUY0RteDNUeFRxWXM2XG5OYUxqZU5EZGNqeFlpN3Z6c0x3eHpOUzdNbDhQaEhhdEE0enFyOExIdEtLdkZaYlF6OGhzaytGRHBpUzU5dVNQXG5TNXRvNUdzYUkxdE5uVjZyVjV0aW5ER01LUzd4YTNqSmNOVHFxZG1ITFJpWmRteW92Wkc1ZzRjMzQzSUtVc1N6XG4xQjlSWExObkI4VlFNR1pIVVlVWEJaNTVreG1LeDNWSTRFeVUydys5cEU5TmlreHB1MjU5Wk5uLzFVbEFBbUpVXG56eldwdWN4a2N5Y0NCbWhnTGYzNHdhcm5vUlZRUGh0cmtWbFRkK004ZlhJdUorRjdoSE9YMllJRmZNalFPQ1J2XG5KS1dZOWptR2RINklrbmpTSEhWTkRuUm41WXJtT3gzTzdEN25VRmJleEl1dXpaeFJZazFtQUhxL2Vna3MwWnRQXG5DbkRLVGJxNjVRY1RxTHBCa3VSc1R4Q3YvK3RHRXdWTjQwSWlMOXdyVkM3TUtiSTlSS3h0SjNJZ0QySm5PQTR4XG4rRlJ2RDVMTGFiUVRjUXZoZ2REYkE4WXZ3aVVRRmppeDlFTVZHQ3VUcnkvai9sajVPSWlHc3lheGxZWU0xQlJLXG5SRU5oMGFxZXlFRFVBTFAwcW1QamtZKzRBdmhoOHExREpjWVZodkwyMkIyd0FMODJaZmpyZmxKZFVDQUZ4N3hkXG5aMzI0eG9XK3B2dytjTnpDdVJPdGhWaUZTU1pKQk1PVnBDRms3ZWxwV2dDc1ZMN2psY2kwMHdaQThrTEVhaTg1XG52cnFhdEl6bHo4YkMzQUpScHVtK1hWYnZ6Y2RWbWJTdFVUOFZGc204WmtaVDA0bkE9PXx8T0d3T1J6ZG5IK2xzXG5KUW43UERqZXAxTEt6R0tiQU5lL01lanNUYXZySWRNQzR0eENPYkRMZWJ5OWgvNXc0WTM4NEVOZWhuZW9zdEtwXG5hVW93cFdSSEwrc0R1TUpNN3FMNExoeTVacE10U1AycSt4ZkVSWkdScEhJQU50SmMwcU1wOXhLQW1yOXBlclJRXG55Y2dTenNUMEdqV2YwVDVoQlk0cUVhbitOQWRhaEtVT0t0NTZrYURGRHZ6OEJiTjRHOVlHejgvNmcrVkxjUis1XG5UVWt3alJ0T3BxYStyWFB0anRpaHhESFpVMDNvL3h0eCtsQ3lMMmFlV28veE1mQzBvTXE3MjVnVzJVY0xNM1R3XG4yU0p2akh1Qjl1OTRTTkhiajRORWhDU08yWVZVUjVaemVic254M0JpcHdSVm5ESVNUSU15S1lGU0cwZVlCM29MXG4xTTEyRmI5aE5BPT1cbi0tLS0tRU5EIExJQ0VOU0UgS0VZLS0tLS0iLCJ4NTA5IjoiLS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tXG5NSUlFRERDQ0FmUUNDUUNxZzJvRFQ4MHh3akFOQmdrcWhraUc5dzBCQVFVRkFEQklNUXN3Q1FZRFZRUUdFd0pFXG5SVEVQTUEwR0ExVUVDQXdHUW1WeWJHbHVNUTh3RFFZRFZRUUhEQVpDWlhKc2FXNHhGekFWQmdOVkJBTU1EbXhwXG5ZMlZ1YzJVdWJqaHVMbWx2TUI0WERUSXlNRFl5TkRBME1UQTBNRm9YRFRJek1EWXlOREEwTVRBME1Gb3dTREVMXG5NQWtHQTFVRUJoTUNSRVV4RHpBTkJnTlZCQWdNQmtKbGNteHBiakVQTUEwR0ExVUVCd3dHUW1WeWJHbHVNUmN3XG5GUVlEVlFRRERBNXNhV05sYm5ObExtNDRiaTVwYnpDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDXG5BUW9DZ2dFQkFNQk0wNVhCNDRnNXhmbUNMd2RwVVR3QVQ4K0NCa3lMS0ZzZXprRDVLLzZXaGFYL1hyc2QvUWQwXG4yMEo3d2w1V2RIVTRjVkJtRlJqVndWemtsQ0syeVlKaThtang4c1hzR3E5UTFsYlVlTUtmVjlkc2dmdWhubEFTXG50blFaZ2x1Z09uRjJGZ1JoWGIvakswdHhUb2FvK2JORTZyNGdJRXpwa3RITEJUWXZ2aXVKbXJlZjdXYlBSdDRJXG5uZDlEN2xoeWJlYnloVjdrdXpqUUEvcFBLSFRGczhNVEhaOGhZVXhSeXJwbTMrTVl6UUQrYmpBMlUxRkljdGFVXG53UVhZV2FON3QydVR3Q3Q5ekFLc21ZL1dlT2J2bDNUWk41T05MQXp5V0dDdWxtNWN3S1IzeGJsQlp6WG5CNmdzXG5Pbk4yT0FkU3RjelRWQ3ljbThwY0ZVcnl0S1NLa0dFQ0F3RUFBVEFOQmdrcWhraUc5dzBCQVFVRkFBT0NBZ0VBXG5sSjAxd2NuMXZqWFhDSHVvaTdSMERKMWxseDErZGFmcXlFcVBBMjdKdStMWG1WVkdYUW9yUzFiOHhqVXFVa2NaXG5UQndiV0ZPNXo1ZFptTnZuYnlqYXptKzZvT2cwUE1hWXhoNlRGd3NJMlBPYmM3YkZ2MmVheXdQdC8xQ3BuYzQwXG5xVU1oZnZSeC9HQ1pQQ1d6My8yUlBKV1g5alFEU0hYQ1hxOEJXK0kvM2N1TERaeVkzZkVZQkIwcDNEdlZtYWQ2XG42V0hRYVVyaU4wL0xxeVNPcC9MWmdsbC90MDI5Z1dWdDA1WmliR29LK2NWaFpFY3NMY1VJaHJqMnVGR0ZkM0ltXG5KTGcxSktKN2pLU0JVUU9kSU1EdnNGVUY3WWRNdk11ckNZQTJzT05OOENaK0k1eFFWMUtTOWV2R0hNNWZtd2dTXG5PUEZ2UHp0RENpMC8xdVc5dE9nSHBvcnVvZGFjdCtFWk5rQVRYQ3ZaaXUydy9xdEtSSkY0VTRJVEVtNWFXMGt3XG42enVDOHh5SWt0N3ZoZHM0OFV1UlNHSDlqSnJBZW1sRWl6dEdJTGhHRHF6UUdZYmxoVVFGR01iQmI3amhlTHlDXG5MSjFXT0c2MkYxc3B4Q0tCekVXNXg2cFIxelQxbWhFZ2Q0TWtMYTZ6UFRwYWNyZDk1QWd4YUdLRUxhMVJXU0ZwXG5NdmRoR2s0TnY3aG5iOHIrQnVNUkM2aWVkUE1DelhxL001MGNOOEFnOGJ3K0oxYUZvKzBFSzJoV0phN2tpRStzXG45R3ZGalNkekNGbFVQaEtra1Vaa1NvNWFPdGNRcTdKdTZrV0JoTG9GWUtncHJscDFRVkIwc0daQTZvNkR0cWphXG5HNy9SazZ2YmFZOHdzTllLMnpCWFRUOG5laDVab1JaL1BKTFV0RUV0YzdZPVxuLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLSJ9	f
\.


--
-- Data for Name: shared_credentials; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.shared_credentials ("credentialsId", "projectId", role, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: shared_workflow; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.shared_workflow ("workflowId", "projectId", role, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: tag_entity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.tag_entity (name, "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: test_case_execution; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.test_case_execution (id, "testRunId", "executionId", status, "runAt", "completedAt", "errorCode", "errorDetails", metrics, "createdAt", "updatedAt", inputs, outputs) FROM stdin;
\.


--
-- Data for Name: test_run; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.test_run (id, "workflowId", status, "errorCode", "errorDetails", "runAt", "completedAt", metrics, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n."user" (id, email, "firstName", "lastName", password, "personalizationAnswers", "createdAt", "updatedAt", settings, disabled, "mfaEnabled", "mfaSecret", "mfaRecoveryCodes", "lastActiveAt", "roleSlug") FROM stdin;
9f12b0ff-372b-4d46-b8ea-30c14a4a14a2	golfergeek@orchestratorai.io	Golfer	Geek	$2a$10$5GQh3k/cRVa6iXMmTerh0uPGTsowKkMWHAcU/6QgXoVG3p5bOjx3u	{"version":"v4","personalization_survey_submitted_at":"2025-10-09T20:45:55.451Z","personalization_survey_n8n_version":"1.113.3","companySize":"<20","companyType":"saas","role":"business-owner","reportedSource":"youtube"}	2025-10-09 20:29:48.187+00	2025-10-09 20:45:55.484+00	{"userActivated": false}	f	f	\N	\N	2025-10-09	global:owner
\.


--
-- Data for Name: user_api_keys; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.user_api_keys (id, "userId", label, "apiKey", "createdAt", "updatedAt", scopes) FROM stdin;
zQTzYfs7ExLSDksn	9f12b0ff-372b-4d46-b8ea-30c14a4a14a2	OrchestratorAI	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZjEyYjBmZi0zNzJiLTRkNDYtYjhlYS0zMGMxNGE0YTE0YTIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwMDQyOTA4fQ.kGRjGIPvyOptWjzFAatIt0KZbG7leeRYoNhyifC73BM	2025-10-09 20:48:28.884+00	2025-10-09 20:48:28.884+00	["credential:create","credential:delete","credential:move","project:create","project:delete","project:list","project:update","securityAudit:generate","sourceControl:pull","tag:create","tag:delete","tag:list","tag:read","tag:update","user:changeRole","user:create","user:delete","user:enforceMfa","user:list","user:read","variable:create","variable:delete","variable:list","variable:update","workflow:create","workflow:delete","workflow:list","workflow:move","workflow:read","workflow:update","workflowTags:update","workflowTags:list","workflow:activate","workflow:deactivate","execution:delete","execution:read","execution:retry","execution:list"]
\.


--
-- Data for Name: variables; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.variables (key, type, value, id) FROM stdin;
\.


--
-- Data for Name: webhook_entity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.webhook_entity ("webhookPath", method, node, "webhookId", "pathLength", "workflowId") FROM stdin;
\.


--
-- Data for Name: workflow_entity; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.workflow_entity (name, active, nodes, connections, "createdAt", "updatedAt", settings, "staticData", "pinData", "versionId", "triggerCount", id, meta, "parentFolderId", "isArchived") FROM stdin;
\.


--
-- Data for Name: workflow_history; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.workflow_history ("versionId", "workflowId", authors, "createdAt", "updatedAt", nodes, connections) FROM stdin;
\.


--
-- Data for Name: workflow_statistics; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.workflow_statistics (count, "latestEvent", name, "workflowId", "rootCount") FROM stdin;
\.


--
-- Data for Name: workflows_tags; Type: TABLE DATA; Schema: n8n; Owner: -
--

COPY n8n.workflows_tags ("workflowId", "tagId") FROM stdin;
\.


--
-- Data for Name: agent_orchestrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_orchestrations (id, organization_slug, agent_slug, slug, display_name, description, status, orchestration_json, prompt_templates, tags, version, created_by, updated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agents (id, organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, agent_card, context, config, created_at, updated_at, function_code) FROM stdin;
894f8b22-5bcd-43fe-b900-ac9575933095	my-org	image_openai_generator	OpenAI Image Generator	Generates images via OpenAI function handler	function	full_cycle	1.0.0	active	{"metadata": {"type": "function", "category": "image", "description": "Generates images via OpenAI provider", "displayName": "OpenAI Image Generator"}, "hierarchy": {"department": "images", "reports_to": "image_orchestrator"}, "input_modes": ["text/plain"], "capabilities": ["image_generation"], "output_modes": ["image/png", "image/jpeg", "application/json"], "configuration": {"function": {"code": "async function handler(input, ctx) {\\n  const { prompt, size = '512x512', n = 1, deliverableId = null } = input || {};\\n  const out = await ctx.services.images.generate({ prompt, size, n, title: 'OpenAI Images', provider: 'openai', deliverableId });\\n  return out;\\n}", "version": "1", "language": "js", "timeout_ms": 20000}, "execution_profile": "full_cycle", "execution_capabilities": {"can_plan": false, "can_build": true, "requires_human_gate": false}}}	\N	{}	{"hierarchy": {"department": "images", "reports_to": "image_orchestrator"}, "input_modes": ["text/plain"], "capabilities": ["image_generation"], "output_modes": ["image/png", "image/jpeg", "application/json"], "configuration": {"function": {"code": "async function handler(input, ctx) {\\n  const { prompt, size = '512x512', n = 1, deliverableId = null } = input || {};\\n  const out = await ctx.services.images.generate({ prompt, size, n, title: 'OpenAI Images', provider: 'openai', deliverableId });\\n  return out;\\n}", "version": "1", "language": "js", "timeout_ms": 20000}, "execution_profile": "full_cycle", "execution_capabilities": {"can_plan": false, "can_build": true, "requires_human_gate": false}}}	2025-10-09 19:18:09.86463+00	2025-10-09 19:18:09.86463+00	\N
c2eff940-40ce-409c-b099-c449a3921f86	my-org	image_google_generator	Google Image Generator	Generates images via Google (Gemini/Imagen) function handler	function	full_cycle	1.0.0	active	{"metadata": {"type": "function", "category": "image", "description": "Generates images via Google (Gemini/Imagen) provider", "displayName": "Google Image Generator"}, "hierarchy": {"department": "images", "reports_to": "image_orchestrator"}, "input_modes": ["text/plain"], "capabilities": ["image_generation"], "output_modes": ["image/png", "image/jpeg", "application/json"], "configuration": {"function": {"code": "async function handler(input, ctx) {\\n  const { prompt, size = '512x512', n = 1, deliverableId = null } = input || {};\\n  const out = await ctx.services.images.generate({ prompt, size, n, title: 'Google Images', provider: 'gemini', deliverableId });\\n  return out;\\n}", "version": "1", "language": "js", "timeout_ms": 20000}, "execution_profile": "full_cycle", "execution_capabilities": {"can_plan": false, "can_build": true, "requires_human_gate": false}}}	\N	{}	{"hierarchy": {"department": "images", "reports_to": "image_orchestrator"}, "input_modes": ["text/plain"], "capabilities": ["image_generation"], "output_modes": ["image/png", "image/jpeg", "application/json"], "configuration": {"function": {"code": "async function handler(input, ctx) {\\n  const { prompt, size = '512x512', n = 1, deliverableId = null } = input || {};\\n  const out = await ctx.services.images.generate({ prompt, size, n, title: 'Google Images', provider: 'gemini', deliverableId });\\n  return out;\\n}", "version": "1", "language": "js", "timeout_ms": 20000}, "execution_profile": "full_cycle", "execution_capabilities": {"can_plan": false, "can_build": true, "requires_human_gate": false}}}	2025-10-09 19:18:09.86463+00	2025-10-09 19:18:09.86463+00	\N
68e1bfe7-df65-4dfa-b3bf-09bd283cb8fa	my-org	image_orchestrator	Image Orchestrator	Fan-out image generation to multiple providers	function	full_cycle	1.0.0	active	{"metadata": {"type": "function", "category": "image", "description": "Fans out image generation across multiple providers", "displayName": "Image Orchestrator"}, "hierarchy": {"team": ["image_openai_generator", "image_google_generator"], "department": "images"}, "input_modes": ["text/plain"], "capabilities": ["image_generation"], "output_modes": ["image/png", "image/jpeg", "application/json"], "configuration": {"function": {"code": "async function handler(input, ctx) {\\n  const { prompt, size = '512x512', n = 1, providers = ['openai','gemini'], deliverableId = null } = input || {};\\n  let last = null;\\n  for (const p of providers) {\\n    last = await ctx.services.images.generate({ prompt, size, n, title: 'Image Orchestrator', provider: p, deliverableId });\\n  }\\n  return last;\\n}", "version": "1", "language": "js", "timeout_ms": 20000}, "execution_profile": "full_cycle", "execution_capabilities": {"can_plan": false, "can_build": true, "requires_human_gate": false}}}	\N	{}	{"hierarchy": {"team": ["image_openai_generator", "image_google_generator"], "department": "images"}, "input_modes": ["text/plain"], "capabilities": ["image_generation"], "output_modes": ["image/png", "image/jpeg", "application/json"], "configuration": {"function": {"code": "async function handler(input, ctx) {\\n  const { prompt, size = '512x512', n = 1, providers = ['openai','gemini'], deliverableId = null } = input || {};\\n  let last = null;\\n  for (const p of providers) {\\n    last = await ctx.services.images.generate({ prompt, size, n, title: 'Image Orchestrator', provider: p, deliverableId });\\n  }\\n  return last;\\n}", "version": "1", "language": "js", "timeout_ms": 20000}, "execution_profile": "full_cycle", "execution_capabilities": {"can_plan": false, "can_build": true, "requires_human_gate": false}}}	2025-10-09 19:18:09.866585+00	2025-10-09 19:18:09.866585+00	\N
48271c6f-5de4-410f-ac04-6ca194415b47	demo	orchestrator	Demo Orchestrator	Coordinates multi-agent workflows for the demo namespace and delegates follow-up to specialists.	orchestrator	orchestrator_full	\N	active	\n{\n    "metadata": {\n        "name": "demo-orchestrator",\n        "displayName": "Demo Orchestrator",\n        "description": "Coordinates multi-step workflows for the demo namespace and delegates tasks to specialists.",\n        "version": "0.1.0",\n        "type": "orchestrator",\n        "tags": [\n            "demo",\n            "orchestrator",\n            "multi-agent"\n        ]\n    },\n    "capabilities": [\n        "converse",\n        "plan",\n        "build",\n        "delegate"\n    ],\n    "communication": {\n        "input_modes": [\n            "text/plain"\n        ],\n        "output_modes": [\n            "text/markdown",\n            "application/json"\n        ]\n    },\n    "configuration": {\n        "execution_capabilities": {\n            "supports_converse": true,\n            "supports_plan": true,\n            "supports_build": true,\n            "supports_orchestration": true\n        },\n        "prompt_prefix": "You are the primary orchestrator for the demo organization. Coordinate specialists, capture assumptions, and keep stakeholders informed."\n    },\n    "skills": [\n        {\n            "id": "orchestration-plan",\n            "name": "Produce orchestration plans",\n            "description": "Drafts multi-phase execution plans with owners, expected outputs, and checkpoints.",\n            "tags": [\n                "planning",\n                "coordination"\n            ],\n            "input_modes": [\n                "text/plain"\n            ],\n            "output_modes": [\n                "text/markdown"\n            ]\n        },\n        {\n            "id": "delegation-bridge",\n            "name": "Delegate supporting agents",\n            "description": "Identifies supporting agents, crafts delegation prompts, and tracks follow-ups.",\n            "tags": [\n                "delegation"\n            ],\n            "input_modes": [\n                "text/plain"\n            ],\n            "output_modes": [\n                "application/json"\n            ]\n        }\n    ],\n    "prompts": {\n        "system": "You are the Demo Orchestrator agent. Plan complex multi-step efforts, call out risks, and prepare the team to execute. Always provide a structured response with sections for context, execution plan, risks, and next steps.",\n        "plan": "Create an orchestration plan broken into numbered phases. Each phase must include an objective, concrete tasks, supporting agents/tools, and a readiness checklist.",\n        "build": "Summarize the execution status for all phases, including completed work, outstanding items, and human checkpoints that need attention.",\n        "human": "Clearly describe what decision or input the human stakeholder must provide to continue the orchestration."\n    },\n    "context": {\n        "plan_rubric": {\n            "required_sections": [\n                "Context",\n                "Objectives",\n                "Phases",\n                "Risks",\n                "Next Steps"\n            ],\n            "default_phase_labels": [\n                "Discovery",\n                "Design",\n                "Implementation",\n                "Validation"\n            ],\n            "risk_checks": [\n                "Call out missing approvals",\n                "Highlight resource gaps",\n                "Track dependencies across teams"\n            ]\n        },\n        "input_modes": [\n            "text/plain"\n        ],\n        "output_modes": [\n            "text/markdown",\n            "application/json"\n        ]\n    }\n}\n	\N	{"input_modes": ["text/plain"], "output_modes": ["text/markdown", "application/json"], "supported_modes": ["converse", "plan", "build"]}	{"streaming": {"enabled": true}, "extensions": ["orchestration:v1"], "default_llm": "gpt-4o-mini", "capabilities": ["delegate", "orchestrate"], "deliverables": {"enabled": true}, "notifications": {"push": true}, "stateTracking": {"enabled": true}, "supported_modes": ["converse", "plan", "build"]}	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00	\N
d7652e39-79c2-45d5-825e-cbef0e70efe5	my-org	requirements-specialist	Requirements Specialist	Transforms stakeholder requests into structured product requirements and acceptance criteria for my-org.	specialist	specialist_full	\N	active	\n{\n    "metadata": {\n        "name": "my-org-requirements-specialist",\n        "displayName": "Requirements Specialist",\n        "description": "Transforms stakeholder requests into structured product requirements and acceptance criteria for the my-org namespace.",\n        "version": "0.1.0",\n        "type": "specialist",\n        "tags": [\n            "my-org",\n            "requirements",\n            "analysis"\n        ]\n    },\n    "capabilities": [\n        "converse",\n        "plan",\n        "build"\n    ],\n    "communication": {\n        "input_modes": [\n            "text/plain"\n        ],\n        "output_modes": [\n            "text/markdown",\n            "application/json"\n        ]\n    },\n    "configuration": {\n        "execution_capabilities": {\n            "supports_converse": true,\n            "supports_plan": true,\n            "supports_build": true,\n            "supports_orchestration": false\n        },\n        "prompt_prefix": "You are a senior requirements analyst. Clarify ambiguous stakeholder input, capture explicit assumptions, and produce structured requirements packages."\n    },\n    "skills": [\n        {\n            "id": "clarify-context",\n            "name": "Clarify context",\n            "description": "Asks targeted follow-up questions to remove ambiguity and document assumptions.",\n            "tags": [\n                "analysis",\n                "discovery"\n            ],\n            "input_modes": [\n                "text/plain"\n            ],\n            "output_modes": [\n                "text/markdown"\n            ]\n        },\n        {\n            "id": "craft-requirements",\n            "name": "Craft structured requirements",\n            "description": "Produces user stories, acceptance criteria, and traceability matrices.",\n            "tags": [\n                "requirements",\n                "documentation"\n            ],\n            "input_modes": [\n                "text/plain"\n            ],\n            "output_modes": [\n                "text/markdown",\n                "application/json"\n            ]\n        }\n    ],\n    "prompts": {\n        "system": "You are the Requirements Specialist agent. Create precise, testable requirements packages and flag missing information.",\n        "plan": "Summarize the discovery plan you will follow, including questions to ask and artifacts to gather.",\n        "build": "Produce a requirements package with sections for problem statement, user stories, acceptance criteria, open questions, and implementation considerations.",\n        "human": "List any clarifications or approvals still required from stakeholders."\n    },\n    "context": {\n        "templates": {\n            "requirements_package": {\n                "sections": [\n                    "Problem Statement",\n                    "User Stories",\n                    "Acceptance Criteria",\n                    "Open Questions",\n                    "Implementation Considerations"\n                ]\n            }\n        },\n        "input_modes": [\n            "text/plain"\n        ],\n        "output_modes": [\n            "text/markdown",\n            "application/json"\n        ]\n    }\n}\n	\N	{"input_modes": ["text/plain"], "output_modes": ["text/markdown", "application/json"], "supported_modes": ["converse", "plan", "build"]}	{"streaming": {"enabled": true}, "default_llm": "gpt-4o-mini", "capabilities": ["requirements", "analysis"], "supported_modes": ["converse", "plan", "build"]}	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00	\N
61ed59b0-ebb1-4f87-98d1-2df4c21d9509	my-org	blog_post_writer	Blog Post Writer	Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.	specialist	specialist_full	\N	active	\nname: blog_post_writer\ndisplay_name: Blog Post Writer\ndescription: Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.\nagent_type: context\nmode_profile: plan-build-converse\nversion: "1.0"\nstatus: active\n\nsystem_prompt: |\n  Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.\n\n  When creating a plan for a blog post, structure it with the following sections:\n\n  # Blog Post Plan\n\n  ## Title & Topic\n  - Working title\n  - Target topic/theme\n  - Angle or unique perspective\n\n  ## Audience & Purpose\n  - Target audience description\n  - Primary goal (inform, persuade, entertain, etc.)\n  - Reader takeaway\n\n  ## Content Strategy\n  - Word count target\n  - SEO keywords\n  - Key points to cover\n\n  When building a deliverable, create:\n  - Engaging introduction\n  - Clear section headings\n  - Actionable content\n  - Strong conclusion with CTA\n\n  When conversing, provide helpful suggestions for improving blog content.\n\nmodes:\n  plan:\n    enabled: true\n    actions:\n      - create\n      - read\n      - list\n      - edit\n      - set_current\n      - delete_version\n      - merge_versions\n      - copy_version\n      - delete\n\n  build:\n    enabled: true\n    actions:\n      - create\n      - read\n      - list\n      - edit\n      - rerun\n      - set_current\n      - delete_version\n      - merge_versions\n      - copy_version\n      - delete\n\n  converse:\n    enabled: true\n\nllm_defaults:\n  provider: ollama\n  model: llama3.2:1b\n  temperature: 0.7\n	{"system_prompt": "Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.\\n\\nWhen creating a plan for a blog post, structure it with the following sections:\\n\\n# Blog Post Plan\\n\\n## Title & Topic\\n- Working title\\n- Target topic/theme\\n- Angle or unique perspective\\n\\n## Audience & Purpose\\n- Target audience description\\n- Primary goal (inform, persuade, entertain, etc.)\\n- Reader takeaway\\n\\n## Content Strategy\\n- Word count target\\n- SEO keywords\\n- Key points to cover\\n\\nWhen building a deliverable, create:\\n- Engaging introduction\\n- Clear section headings\\n- Actionable content\\n- Strong conclusion with CTA\\n\\nWhen conversing, provide helpful suggestions for improving blog content."}	{"plan": {"template": "Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.\\n\\nWhen creating a plan for a blog post, structure it with the following sections:\\n\\n# Blog Post Plan\\n\\n## Title & Topic\\n- Working title\\n- Target topic/theme\\n- Angle or unique perspective\\n\\n## Audience & Purpose\\n- Target audience description\\n- Primary goal (inform, persuade, entertain, etc.)\\n- Reader takeaway\\n\\n## Content Strategy\\n- Word count target\\n- SEO keywords\\n- Key points to cover\\n\\nWhen building a deliverable, create:\\n- Engaging introduction\\n- Clear section headings\\n- Actionable content\\n- Strong conclusion with CTA\\n\\nWhen conversing, provide helpful suggestions for improving blog content."}, "build": {"template": "Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.\\n\\nWhen creating a plan for a blog post, structure it with the following sections:\\n\\n# Blog Post Plan\\n\\n## Title & Topic\\n- Working title\\n- Target topic/theme\\n- Angle or unique perspective\\n\\n## Audience & Purpose\\n- Target audience description\\n- Primary goal (inform, persuade, entertain, etc.)\\n- Reader takeaway\\n\\n## Content Strategy\\n- Word count target\\n- SEO keywords\\n- Key points to cover\\n\\nWhen building a deliverable, create:\\n- Engaging introduction\\n- Clear section headings\\n- Actionable content\\n- Strong conclusion with CTA\\n\\nWhen conversing, provide helpful suggestions for improving blog content."}, "converse": {"template": "Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.\\n\\nWhen creating a plan for a blog post, structure it with the following sections:\\n\\n# Blog Post Plan\\n\\n## Title & Topic\\n- Working title\\n- Target topic/theme\\n- Angle or unique perspective\\n\\n## Audience & Purpose\\n- Target audience description\\n- Primary goal (inform, persuade, entertain, etc.)\\n- Reader takeaway\\n\\n## Content Strategy\\n- Word count target\\n- SEO keywords\\n- Key points to cover\\n\\nWhen building a deliverable, create:\\n- Engaging introduction\\n- Clear section headings\\n- Actionable content\\n- Strong conclusion with CTA\\n\\nWhen conversing, provide helpful suggestions for improving blog content."}}	{"llm_defaults": {"model": "llama3.2:1b", "provider": "ollama", "temperature": 0.7}}	2025-10-09 19:18:09.907966+00	2025-10-09 19:41:45.978701+00	\N
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assets (id, storage, path, bucket, object_key, mime, size, width, height, hash, user_id, conversation_id, deliverable_version_id, created_at, updated_at, source_url) FROM stdin;
\.


--
-- Data for Name: cidafm_commands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cidafm_commands (id, type, name, description, default_active, is_builtin, created_at, updated_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440001	^	format_markdown	Format response as Markdown with proper headers and structure	f	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
550e8400-e29b-41d4-a716-446655440002	^	format_json	Format response as JSON with proper structure	f	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
550e8400-e29b-41d4-a716-446655440003	&	include_examples	Include practical examples in the response	f	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
550e8400-e29b-41d4-a716-446655440004	&	include_code	Include code snippets and implementation details	f	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
550e8400-e29b-41d4-a716-446655440005	!	exclude_theory	Focus on practical implementation, avoid theoretical explanations	f	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
550e8400-e29b-41d4-a716-446655440006	!	exclude_warnings	Skip safety warnings and disclaimers	f	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, user_id, agent_name, agent_type, started_at, last_active_at, metadata, created_at, updated_at, organization_slug, ended_at) FROM stdin;
66f858b9-0d63-4afa-9052-10b661543c05	b29a590e-b07f-49df-a25b-574c956b5035	Dashboard Builder Agent	conversation_agent	2025-09-30 19:18:09.981049+00	2025-09-30 21:18:09.981049+00	{"title": "Build React Dashboard Component", "priority": "normal", "complexity": "medium", "project_type": "mobile_app"}	2025-09-30 19:18:09.981049+00	2025-09-30 21:18:09.981049+00	\N	\N
5931a44f-506e-4377-b637-bf5bdfe79e8b	b29a590e-b07f-49df-a25b-574c956b5035	Authentication Agent	conversation_agent	2025-10-01 19:18:09.981049+00	2025-10-01 21:18:09.981049+00	{"title": "Implement User Authentication System", "priority": "low", "complexity": "low", "project_type": "api"}	2025-10-01 19:18:09.981049+00	2025-10-01 21:18:09.981049+00	\N	\N
91642195-1f88-4f3d-a88d-bc5d05440f80	b29a590e-b07f-49df-a25b-574c956b5035	Database Designer Agent	conversation_agent	2025-10-02 19:18:09.981049+00	2025-10-02 21:18:09.981049+00	{"title": "Design Database Schema", "priority": "urgent", "complexity": "high", "project_type": "web_app"}	2025-10-02 19:18:09.981049+00	2025-10-02 21:18:09.981049+00	\N	\N
2e536d84-d5c8-4c2e-bf58-436b5d7dd493	b29a590e-b07f-49df-a25b-574c956b5035	API Security Agent	conversation_agent	2025-10-03 19:18:09.981049+00	2025-10-03 21:18:09.981049+00	{"title": "Create API Rate Limiting Strategy", "priority": "normal", "complexity": "medium", "project_type": "mobile_app"}	2025-10-03 19:18:09.981049+00	2025-10-03 21:18:09.981049+00	\N	\N
bff9ce60-05b5-42fb-b508-8bf3b973aadd	b29a590e-b07f-49df-a25b-574c956b5035	Mobile UX Agent	conversation_agent	2025-10-04 19:18:09.981049+00	2025-10-04 21:18:09.981049+00	{"title": "Develop Mobile App Navigation", "priority": "low", "complexity": "low", "project_type": "api"}	2025-10-04 19:18:09.981049+00	2025-10-04 21:18:09.981049+00	\N	\N
c6741ed7-9003-4921-8dda-9aa6729f2916	b29a590e-b07f-49df-a25b-574c956b5035	Payment Integration Agent	conversation_agent	2025-10-05 19:18:09.981049+00	2025-10-05 21:18:09.981049+00	{"title": "Setup Payment Integration", "priority": "urgent", "complexity": "high", "project_type": "web_app"}	2025-10-05 19:18:09.981049+00	2025-10-05 21:18:09.981049+00	\N	\N
70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	b29a590e-b07f-49df-a25b-574c956b5035	Email Template Agent	conversation_agent	2025-10-06 19:18:09.981049+00	2025-10-06 21:18:09.981049+00	{"title": "Build Email Template System", "priority": "normal", "complexity": "medium", "project_type": "mobile_app"}	2025-10-06 19:18:09.981049+00	2025-10-06 21:18:09.981049+00	\N	\N
d6671925-606e-462b-ae7c-66f46bf3f1b4	b29a590e-b07f-49df-a25b-574c956b5035	Search Optimization Agent	conversation_agent	2025-10-07 19:18:09.981049+00	2025-10-07 21:18:09.981049+00	{"title": "Implement Search Functionality", "priority": "low", "complexity": "low", "project_type": "api"}	2025-10-07 19:18:09.981049+00	2025-10-07 21:18:09.981049+00	\N	\N
9e6f502b-ba20-4e24-88a7-0ce85149c18b	b29a590e-b07f-49df-a25b-574c956b5035	Performance Agent	conversation_agent	2025-10-08 19:18:09.981049+00	2025-10-08 21:18:09.981049+00	{"title": "Optimize Application Performance", "priority": "urgent", "complexity": "high", "project_type": "web_app"}	2025-10-08 19:18:09.981049+00	2025-10-08 21:18:09.981049+00	\N	\N
9cfb3f53-02c6-4951-8e04-0fb624fad0e7	b29a590e-b07f-49df-a25b-574c956b5035	Security Audit Agent	conversation_agent	2025-10-09 19:18:09.981049+00	2025-10-09 21:18:09.981049+00	{"title": "Conduct Security Audit", "priority": "normal", "complexity": "medium", "project_type": "mobile_app"}	2025-10-09 19:18:09.981049+00	2025-10-09 21:18:09.981049+00	\N	\N
38ef70b5-1a48-4024-81f3-8c937f3dcea6	a1b2c3d4-e5f6-7890-abcd-ef1234567890	blog_post_writer	specialist	2025-10-09 19:54:42.572+00	2025-10-09 19:54:42.572+00	{"source": "frontend"}	2025-10-09 19:54:42.573716+00	2025-10-09 19:54:42.573716+00	my-org	\N
c01c1680-25a0-4bde-a648-e367a4a480d7	a1b2c3d4-e5f6-7890-abcd-ef1234567890	image_google_generator	function	2025-10-09 20:20:53.193+00	2025-10-09 20:20:53.193+00	{"source": "frontend"}	2025-10-09 20:20:53.203362+00	2025-10-09 20:20:53.203362+00	my-org	\N
\.


--
-- Data for Name: deliverable_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deliverable_versions (id, deliverable_id, version_number, content, format, is_current_version, created_by_type, task_id, metadata, file_attachments, created_at, updated_at) FROM stdin;
11d199d2-6575-470a-87df-0866faceaab0	1432230a-6eab-4001-8487-9d27809f37f6	1	# Building a Modern React Dashboard Component\n\nCreating an effective dashboard component is crucial for any modern web application. In this comprehensive guide, we'll explore the essential elements that make a dashboard both functional and visually appealing.\n\n## Key Design Principles\n\nWhen building a dashboard component, consider these fundamental principles:\n\n- **Clarity**: Information should be immediately understandable\n- **Hierarchy**: Most important metrics should be prominently displayed\n- **Responsiveness**: Works seamlessly across all device sizes\n- **Performance**: Loads quickly even with large datasets\n\n## Implementation Strategy\n\nStart with a clean component structure:\n\n```jsx\nconst Dashboard = () => {\n  const [metrics, setMetrics] = useState([]);\n  const [loading, setLoading] = useState(true);\n  \n  return (\n    <div className="dashboard-container">\n      {/* Your dashboard content */}\n    </div>\n  );\n};\n```\n\n## Best Practices\n\n1. Use React hooks for state management\n2. Implement proper error boundaries\n3. Add loading states for better UX\n4. Consider using a charting library like Chart.js or D3\n\nBy following these guidelines, you'll create a dashboard that users love to interact with and that scales with your application's growth.	markdown	t	ai_response	\N	{"topics": ["react", "dashboard", "components", "frontend"], "word_count": 850, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 4}	{}	2025-09-30 21:18:09.981049+00	2025-09-30 21:18:09.981049+00
eb4ba4c4-669d-4c60-9372-42d890b5f4c9	4816b176-aba8-4f82-a9cc-3929430e897a	1	# Implementing Secure User Authentication: A Complete Guide\n\nUser authentication is the cornerstone of any secure web application. This guide walks you through implementing a robust authentication system that protects your users and your data.\n\n## Authentication Fundamentals\n\nModern authentication systems should include:\n\n- **Multi-factor authentication (MFA)**\n- **Secure password policies**\n- **Session management**\n- **Rate limiting**\n- **Account lockout protection**\n\n## JWT vs Session-Based Auth\n\n### JSON Web Tokens (JWT)\n\nJWTs offer stateless authentication with these advantages:\n- No server-side session storage required\n- Easy to scale across multiple servers\n- Built-in expiration handling\n\n### Session-Based Authentication\n\nTraditional sessions provide:\n- Immediate revocation capability\n- Server-side control over user sessions\n- Smaller client-side footprint\n\n## Implementation Steps\n\n1. **Choose your authentication strategy**\n2. **Set up secure password hashing** (use bcrypt or similar)\n3. **Implement login/logout endpoints**\n4. **Add middleware for route protection**\n5. **Create user registration flow**\n6. **Add password reset functionality**\n\n## Security Considerations\n\nAlways remember:\n- Hash passwords with salt\n- Use HTTPS in production\n- Implement proper CORS policies\n- Add request rate limiting\n- Log authentication attempts\n\nA well-implemented authentication system is invisible to legitimate users but impenetrable to attackers.	markdown	t	ai_response	\N	{"topics": ["authentication", "security", "jwt", "backend"], "word_count": 1200, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 5}	{}	2025-10-01 21:18:09.981049+00	2025-10-01 21:18:09.981049+00
36f7d5a8-819a-41e0-b7c1-b1f0beafb390	60a1aefa-5dae-43b2-9682-3fae275da290	1	# Database Schema Design: Building Scalable Data Architecture\n\nA well-designed database schema is the foundation of any successful application. This guide covers essential principles and practical strategies for creating databases that scale.\n\n## Schema Design Principles\n\n### Normalization vs Denormalization\n\n**Normalization** reduces data redundancy:\n- Eliminates duplicate data\n- Ensures data consistency\n- Reduces storage requirements\n- Simplifies data updates\n\n**Denormalization** optimizes for read performance:\n- Faster query execution\n- Reduced join complexity\n- Better suited for analytics\n- May increase storage needs\n\n## Essential Design Patterns\n\n### 1. Primary Keys\nAlways use meaningful primary keys:\n```sql\nCREATE TABLE users (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    email VARCHAR(255) UNIQUE NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n```\n\n### 2. Foreign Key Relationships\nMaintain referential integrity:\n```sql\nCREATE TABLE orders (\n    id UUID PRIMARY KEY,\n    user_id UUID REFERENCES users(id),\n    total_amount DECIMAL(10,2)\n);\n```\n\n### 3. Indexing Strategy\nCreate indexes for frequently queried columns:\n```sql\nCREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_orders_user_id ON orders(user_id);\n```\n\n## Performance Optimization\n\n- Use appropriate data types\n- Implement proper indexing\n- Consider partitioning for large tables\n- Monitor query performance regularly\n\nRemember: a good schema design today saves countless hours of refactoring tomorrow.	markdown	t	ai_response	\N	{"topics": ["database", "schema", "design", "sql"], "word_count": 950, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 4}	{}	2025-10-02 21:18:09.981049+00	2025-10-02 21:18:09.981049+00
15d985e3-e61c-4289-914e-497bd7fc2423	9f6ccb77-9b74-4531-8800-5dca05662230	1	# API Rate Limiting: Protecting Your Services from Abuse\n\nRate limiting is essential for maintaining API performance and preventing abuse. Learn how to implement effective rate limiting strategies that protect your infrastructure while providing a smooth experience for legitimate users.\n\n## Why Rate Limiting Matters\n\nWithout proper rate limiting, your API faces several risks:\n- **DDoS attacks** can overwhelm your servers\n- **Resource exhaustion** from excessive requests\n- **Cost escalation** in cloud environments\n- **Poor user experience** due to system slowdowns\n\n## Common Rate Limiting Algorithms\n\n### 1. Token Bucket\n\nThe token bucket algorithm allows bursts while maintaining average limits:\n\n```javascript\nclass TokenBucket {\n  constructor(capacity, refillRate) {\n    this.capacity = capacity;\n    this.tokens = capacity;\n    this.refillRate = refillRate;\n    this.lastRefill = Date.now();\n  }\n  \n  consume(tokens = 1) {\n    this.refill();\n    if (this.tokens >= tokens) {\n      this.tokens -= tokens;\n      return true;\n    }\n    return false;\n  }\n}\n```\n\n### 2. Fixed Window\n\nSimple but effective for most use cases:\n- Reset counters at fixed intervals\n- Easy to implement and understand\n- May allow bursts at window boundaries\n\n### 3. Sliding Window\n\nMore accurate but computationally expensive:\n- Smooth rate limiting\n- No boundary burst issues\n- Requires more memory and processing\n\n## Implementation Best Practices\n\n1. **Choose appropriate limits** based on your infrastructure\n2. **Implement different tiers** for different user types\n3. **Provide clear error messages** when limits are exceeded\n4. **Monitor and adjust** limits based on usage patterns\n5. **Consider geographic distribution** for global applications\n\n## HTTP Status Codes\n\nUse proper status codes:\n- `429 Too Many Requests` for rate limit exceeded\n- Include `Retry-After` header\n- Provide remaining quota in response headers\n\nEffective rate limiting protects your API while maintaining excellent user experience.	markdown	t	ai_response	\N	{"topics": ["api", "rate-limiting", "performance", "security"], "word_count": 1100, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 5}	{}	2025-10-03 21:18:09.981049+00	2025-10-03 21:18:09.981049+00
83c6bf6c-7174-40d4-addb-fd6a69b37a7b	0d2913b0-9775-4b0a-82a2-e69090e99555	1	# Mobile App Navigation: Creating Intuitive User Journeys\n\nGreat mobile navigation is invisible – users should effortlessly move through your app without thinking about how to get where they want to go. This guide explores proven patterns and emerging trends in mobile navigation design.\n\n## Navigation Fundamentals\n\n### The 3-Tap Rule\n\nUsers should reach any feature within three taps:\n- **Tap 1**: Open the app\n- **Tap 2**: Navigate to section\n- **Tap 3**: Access specific feature\n\n### Visual Hierarchy\n\nEstablish clear information architecture:\n- Primary navigation (bottom tabs)\n- Secondary navigation (top tabs or lists)\n- Tertiary navigation (action sheets, modals)\n\n## Popular Navigation Patterns\n\n### 1. Bottom Tab Navigation\n\nBest for 3-5 primary sections:\n\n```jsx\n<Tab.Navigator>\n  <Tab.Screen name="Home" component={HomeScreen} />\n  <Tab.Screen name="Search" component={SearchScreen} />\n  <Tab.Screen name="Profile" component={ProfileScreen} />\n</Tab.Navigator>\n```\n\n**Pros:**\n- Thumb-friendly on mobile devices\n- Always visible\n- Clear section separation\n\n**Cons:**\n- Limited to 5 items maximum\n- Takes up screen space\n\n### 2. Drawer Navigation\n\nIdeal for apps with many sections:\n\n```jsx\n<Drawer.Navigator>\n  <Drawer.Screen name="Dashboard" component={DashboardScreen} />\n  <Drawer.Screen name="Settings" component={SettingsScreen} />\n  <Drawer.Screen name="Help" component={HelpScreen} />\n</Drawer.Navigator>\n```\n\n**Pros:**\n- Accommodates many navigation items\n- Saves screen space\n- Can include user information\n\n**Cons:**\n- Hidden by default\n- Requires gesture or button tap\n\n## Accessibility Considerations\n\n- Use semantic labels for screen readers\n- Ensure sufficient touch target sizes (44pt minimum)\n- Provide clear focus indicators\n- Test with voice control features\n\n## Performance Tips\n\n- Implement lazy loading for screens\n- Use native navigation libraries\n- Optimize animations for 60fps\n- Preload critical screens\n\nGreat navigation feels natural and gets users to their destination quickly and efficiently.	markdown	t	ai_response	\N	{"topics": ["mobile", "navigation", "ux", "design"], "word_count": 1050, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 5}	{}	2025-10-04 21:18:09.981049+00	2025-10-04 21:18:09.981049+00
2c340a02-707f-40ac-be83-ebd8f496fa78	c7aa1741-7264-4daf-8ac8-4913f3364267	1	# Payment Integration Made Simple: Stripe Setup Guide\n\nIntegrating payments into your application doesn't have to be complicated. This comprehensive guide walks you through setting up Stripe payments with security best practices and optimal user experience.\n\n## Why Choose Stripe?\n\nStripe has become the gold standard for online payments:\n- **Security**: PCI DSS compliant out of the box\n- **Global reach**: Supports 135+ currencies\n- **Developer experience**: Excellent APIs and documentation\n- **Features**: Subscriptions, invoicing, marketplaces, and more\n\n## Setup Process\n\n### 1. Account Creation\n\n1. Sign up at stripe.com\n2. Complete business verification\n3. Get your API keys (test and live)\n4. Configure webhook endpoints\n\n### 2. Frontend Integration\n\nInstall Stripe Elements:\n\n```bash\nnpm install @stripe/stripe-js @stripe/react-stripe-js\n```\n\nBasic payment form:\n\n```jsx\nimport { loadStripe } from "@stripe/stripe-js";\nimport { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";\n\nconst PaymentForm = () => {\n  const stripe = useStripe();\n  const elements = useElements();\n  \n  const handleSubmit = async (event) => {\n    event.preventDefault();\n    \n    const { error, paymentMethod } = await stripe.createPaymentMethod({\n      type: "card",\n      card: elements.getElement(CardElement),\n    });\n    \n    if (!error) {\n      // Send paymentMethod.id to your server\n    }\n  };\n  \n  return (\n    <form onSubmit={handleSubmit}>\n      <CardElement />\n      <button type="submit" disabled={!stripe}>\n        Pay Now\n      </button>\n    </form>\n  );\n};\n```\n\n### 3. Backend Integration\n\nServer-side payment processing:\n\n```javascript\nconst stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);\n\napp.post("/create-payment-intent", async (req, res) => {\n  const { amount, currency } = req.body;\n  \n  try {\n    const paymentIntent = await stripe.paymentIntents.create({\n      amount: amount * 100, // Convert to cents\n      currency: currency,\n      metadata: {\n        order_id: req.body.order_id\n      }\n    });\n    \n    res.send({\n      client_secret: paymentIntent.client_secret\n    });\n  } catch (error) {\n    res.status(400).send({ error: error.message });\n  }\n});\n```\n\n## Security Best Practices\n\n1. **Never store card data** on your servers\n2. **Use HTTPS** for all payment pages\n3. **Validate on server-side** before processing\n4. **Implement webhook verification**\n5. **Log payment attempts** for monitoring\n\n## Testing\n\nStripe provides test card numbers:\n- `4242424242424242` - Successful payment\n- `4000000000000002` - Card declined\n- `4000000000009995` - Insufficient funds\n\n## Going Live\n\n1. Complete Stripe account verification\n2. Switch to live API keys\n3. Update webhook endpoints\n4. Test with real payment methods\n5. Monitor payment success rates\n\nWith Stripe, you can focus on your product while trusting that payments are handled securely and reliably.	markdown	t	ai_response	\N	{"topics": ["payments", "stripe", "integration", "security"], "word_count": 1300, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 6}	{}	2025-10-05 21:18:09.981049+00	2025-10-05 21:18:09.981049+00
3c281192-53a8-49bf-83ea-d6c3571c2c12	6ef02b65-cf27-4b78-a791-5f2e1b4e7065	1	# Email Template Systems: Building Responsive Communications\n\nEmail templates are crucial for maintaining consistent brand communication. This guide covers building a flexible, maintainable email template system that works across all email clients.\n\n## Email Template Challenges\n\nEmail rendering is notoriously difficult:\n- **Inconsistent CSS support** across email clients\n- **Limited HTML capabilities**\n- **Responsive design complexity**\n- **Dark mode considerations**\n- **Accessibility requirements**\n\n## Template Architecture\n\n### 1. Base Template Structure\n\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{subject}}</title>\n  <style>\n    /* Inline CSS for maximum compatibility */\n    .container { max-width: 600px; margin: 0 auto; }\n    .header { background-color: #f8f9fa; padding: 20px; }\n    .content { padding: 30px 20px; }\n    .footer { background-color: #6c757d; color: white; padding: 15px; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <div class="header">\n      <img src="{{logo_url}}" alt="{{company_name}}" height="40">\n    </div>\n    <div class="content">\n      {{content}}\n    </div>\n    <div class="footer">\n      <p>{{company_name}} | {{company_address}}</p>\n      <a href="{{unsubscribe_url}}">Unsubscribe</a>\n    </div>\n  </div>\n</body>\n</html>\n```\n\n### 2. Template Components\n\nCreate reusable components:\n\n```javascript\nconst EmailComponents = {\n  button: (text, url, color = "#007bff") => `\n    <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">\n      <tr>\n        <td style="background-color: ${color}; border-radius: 4px; padding: 12px 24px;">\n          <a href="${url}" style="color: white; text-decoration: none; font-weight: bold;">\n            ${text}\n          </a>\n        </td>\n      </tr>\n    </table>\n  `,\n  \n  alert: (message, type = "info") => `\n    <div style="padding: 15px; margin: 20px 0; border-left: 4px solid ${getAlertColor(type)}; background-color: #f8f9fa;">\n      ${message}\n    </div>\n  `\n};\n```\n\n## Template Types\n\n### 1. Transactional Emails\n\n- Welcome messages\n- Password resets\n- Order confirmations\n- Account notifications\n\n### 2. Marketing Emails\n\n- Newsletters\n- Product announcements\n- Promotional campaigns\n- Event invitations\n\n### 3. System Notifications\n\n- Error alerts\n- System maintenance\n- Security notifications\n- Performance reports\n\n## Responsive Design\n\n```css\n@media screen and (max-width: 600px) {\n  .container {\n    width: 100% !important;\n    margin: 0 !important;\n  }\n  \n  .content {\n    padding: 20px 15px !important;\n  }\n  \n  .button {\n    width: 100% !important;\n    text-align: center !important;\n  }\n}\n```\n\n## Testing Strategy\n\n1. **Email client testing**: Gmail, Outlook, Apple Mail\n2. **Device testing**: Desktop, mobile, tablet\n3. **Dark mode testing**: iOS, Android, desktop clients\n4. **Accessibility testing**: Screen readers, keyboard navigation\n\n## Automation and Personalization\n\n```javascript\nconst personalizeEmail = (template, userData) => {\n  return template\n    .replace("{{user_name}}", userData.name)\n    .replace("{{user_email}}", userData.email)\n    .replace("{{custom_content}}", generateCustomContent(userData));\n};\n```\n\n## Performance Optimization\n\n- Optimize images for email\n- Use web-safe fonts\n- Minimize HTML size\n- Implement proper caching\n- Monitor delivery rates\n\nA well-designed email template system ensures consistent, professional communication that engages your audience across all devices and email clients.	markdown	t	ai_response	\N	{"topics": ["email", "templates", "communication", "html"], "word_count": 1150, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 5}	{}	2025-10-06 21:18:09.981049+00	2025-10-06 21:18:09.981049+00
7198727f-e854-4363-b52d-9a7dd479f3a7	9735c935-af21-4d36-a568-a1e8f21d228d	1	# Search Functionality: Building Fast and Relevant Results\n\nImplementing effective search functionality can make or break user experience. This guide explores different search approaches, from simple text matching to advanced full-text search with ranking algorithms.\n\n## Search Implementation Strategies\n\n### 1. Database Full-Text Search\n\nMost databases offer built-in full-text search:\n\n**PostgreSQL:**\n```sql\n-- Create a text search vector\nALTER TABLE articles ADD COLUMN search_vector tsvector;\n\n-- Update search vector\nUPDATE articles SET search_vector = \n  to_tsvector('english', title || ' ' || content);\n\n-- Create index for performance\nCREATE INDEX articles_search_idx ON articles USING gin(search_vector);\n\n-- Search query\nSELECT title, \n       ts_rank(search_vector, query) as rank\nFROM articles, \n     to_tsquery('english', 'javascript & tutorial') query\nWHERE search_vector @@ query\nORDER BY rank DESC;\n```\n\n**MySQL:**\n```sql\n-- Create full-text index\nALTER TABLE articles ADD FULLTEXT(title, content);\n\n-- Search with relevance scoring\nSELECT title,\n       MATCH(title, content) AGAINST('javascript tutorial') as relevance\nFROM articles\nWHERE MATCH(title, content) AGAINST('javascript tutorial')\nORDER BY relevance DESC;\n```\n\n### 2. Elasticsearch Integration\n\nFor advanced search capabilities:\n\n```javascript\nconst { Client } = require('@elastic/elasticsearch');\nconst client = new Client({ node: 'http://localhost:9200' });\n\n// Index a document\nawait client.index({\n  index: 'articles',\n  id: 1,\n  body: {\n    title: 'JavaScript Tutorial',\n    content: 'Learn JavaScript fundamentals...',\n    tags: ['javascript', 'tutorial', 'programming'],\n    published_date: '2024-01-15'\n  }\n});\n\n// Search with multiple criteria\nconst searchResult = await client.search({\n  index: 'articles',\n  body: {\n    query: {\n      bool: {\n        must: [\n          {\n            multi_match: {\n              query: 'javascript tutorial',\n              fields: ['title^2', 'content', 'tags']\n            }\n          }\n        ],\n        filter: [\n          {\n            range: {\n              published_date: {\n                gte: '2024-01-01'\n              }\n            }\n          }\n        ]\n      }\n    },\n    highlight: {\n      fields: {\n        title: {},\n        content: {}\n      }\n    }\n  }\n});\n```\n\n## Search UX Best Practices\n\n### 1. Auto-complete and Suggestions\n\n```javascript\nconst searchSuggestions = async (query) => {\n  if (query.length < 2) return [];\n  \n  const suggestions = await client.search({\n    index: 'articles',\n    body: {\n      suggest: {\n        article_suggest: {\n          prefix: query,\n          completion: {\n            field: 'suggest',\n            size: 5\n          }\n        }\n      }\n    }\n  });\n  \n  return suggestions.body.suggest.article_suggest[0].options;\n};\n```\n\n### 2. Search Filters and Facets\n\n```javascript\nconst searchWithFilters = async (query, filters = {}) => {\n  const must = [{\n    multi_match: {\n      query: query,\n      fields: ['title^2', 'content']\n    }\n  }];\n  \n  const filter = [];\n  \n  if (filters.category) {\n    filter.push({ term: { category: filters.category } });\n  }\n  \n  if (filters.dateRange) {\n    filter.push({\n      range: {\n        published_date: {\n          gte: filters.dateRange.start,\n          lte: filters.dateRange.end\n        }\n      }\n    });\n  }\n  \n  return await client.search({\n    index: 'articles',\n    body: {\n      query: { bool: { must, filter } },\n      aggs: {\n        categories: {\n          terms: { field: 'category' }\n        },\n        date_histogram: {\n          date_histogram: {\n            field: 'published_date',\n            calendar_interval: 'month'\n          }\n        }\n      }\n    }\n  });\n};\n```\n\n## Performance Optimization\n\n### 1. Caching Strategies\n\n```javascript\nconst Redis = require('redis');\nconst redis = Redis.createClient();\n\nconst searchWithCache = async (query) => {\n  const cacheKey = `search:${query}`;\n  const cached = await redis.get(cacheKey);\n  \n  if (cached) {\n    return JSON.parse(cached);\n  }\n  \n  const results = await performSearch(query);\n  await redis.setex(cacheKey, 300, JSON.stringify(results)); // Cache for 5 minutes\n  \n  return results;\n};\n```\n\n### 2. Search Analytics\n\n```javascript\nconst trackSearch = async (query, results, userId) => {\n  await analytics.track({\n    event: 'Search Performed',\n    userId: userId,\n    properties: {\n      query: query,\n      results_count: results.length,\n      timestamp: new Date().toISOString()\n    }\n  });\n};\n```\n\n## Search Quality Metrics\n\n- **Click-through rate**: How often users click search results\n- **Zero-result searches**: Queries that return no results\n- **Search abandonment**: Users who search but don't interact with results\n- **Query reformulation**: Users who modify their search terms\n\nGreat search functionality anticipates user needs and delivers relevant results quickly, making your application more discoverable and user-friendly.	markdown	t	ai_response	\N	{"topics": ["search", "elasticsearch", "performance", "ux"], "word_count": 1250, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 6}	{}	2025-10-07 21:18:09.981049+00	2025-10-07 21:18:09.981049+00
4b5e0ea9-6e44-4430-a603-c9d601e3d010	546aba1a-02a2-4d31-82ba-1518cec015f0	1	# Application Performance Optimization: Speed at Scale\n\nPerformance optimization is an ongoing process that directly impacts user experience and business metrics. This comprehensive guide covers frontend, backend, and infrastructure optimizations that deliver measurable improvements.\n\n## Performance Metrics That Matter\n\n### Core Web Vitals\n\n- **Largest Contentful Paint (LCP)**: < 2.5 seconds\n- **First Input Delay (FID)**: < 100 milliseconds\n- **Cumulative Layout Shift (CLS)**: < 0.1\n\n### Additional Metrics\n\n- **First Contentful Paint (FCP)**: < 1.8 seconds\n- **Time to Interactive (TTI)**: < 3.8 seconds\n- **Total Blocking Time (TBT)**: < 200 milliseconds\n\n## Frontend Optimization\n\n### 1. Code Splitting and Lazy Loading\n\n```javascript\n// Route-based code splitting\nconst Dashboard = lazy(() => import('./Dashboard'));\nconst Settings = lazy(() => import('./Settings'));\n\nfunction App() {\n  return (\n    <Router>\n      <Suspense fallback={<div>Loading...</div>}>\n        <Routes>\n          <Route path="/dashboard" element={<Dashboard />} />\n          <Route path="/settings" element={<Settings />} />\n        </Routes>\n      </Suspense>\n    </Router>\n  );\n}\n\n// Component-level lazy loading\nconst HeavyChart = lazy(() => \n  import('./HeavyChart').then(module => ({\n    default: module.HeavyChart\n  }))\n);\n```\n\n### 2. Image Optimization\n\n```javascript\n// Modern image formats with fallbacks\nconst OptimizedImage = ({ src, alt, width, height }) => {\n  return (\n    <picture>\n      <source srcSet={`${src}.webp`} type="image/webp" />\n      <source srcSet={`${src}.avif`} type="image/avif" />\n      <img \n        src={`${src}.jpg`}\n        alt={alt}\n        width={width}\n        height={height}\n        loading="lazy"\n        decoding="async"\n      />\n    </picture>\n  );\n};\n\n// Responsive images\nconst ResponsiveImage = ({ src, alt }) => {\n  const srcSet = [\n    `${src}-400w.jpg 400w`,\n    `${src}-800w.jpg 800w`,\n    `${src}-1200w.jpg 1200w`\n  ].join(', ');\n  \n  return (\n    <img \n      src={`${src}-800w.jpg`}\n      srcSet={srcSet}\n      sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"\n      alt={alt}\n      loading="lazy"\n    />\n  );\n};\n```\n\n### 3. Memory Management\n\n```javascript\n// Proper cleanup in React\nuseEffect(() => {\n  const subscription = api.subscribe(data => {\n    setData(data);\n  });\n  \n  const timeoutId = setTimeout(() => {\n    // Some delayed operation\n  }, 5000);\n  \n  // Cleanup function\n  return () => {\n    subscription.unsubscribe();\n    clearTimeout(timeoutId);\n  };\n}, []);\n\n// Memoization for expensive calculations\nconst expensiveValue = useMemo(() => {\n  return heavyCalculation(data);\n}, [data]);\n\nconst memoizedComponent = memo(({ items }) => {\n  return (\n    <ul>\n      {items.map(item => <li key={item.id}>{item.name}</li>)}\n    </ul>\n  );\n});\n```\n\n## Backend Optimization\n\n### 1. Database Query Optimization\n\n```sql\n-- Add appropriate indexes\nCREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);\nCREATE INDEX idx_products_category_price ON products(category, price);\n\n-- Optimize queries with EXPLAIN\nEXPLAIN ANALYZE\nSELECT p.name, p.price, c.name as category_name\nFROM products p\nJOIN categories c ON p.category_id = c.id\nWHERE p.price BETWEEN 10 AND 100\nAND c.active = true\nORDER BY p.created_at DESC\nLIMIT 20;\n\n-- Use query result caching\nSELECT /*+ USE_QUERY_CACHE */ \n       product_id, name, price\nFROM products\nWHERE category = 'electronics'\nAND price < 500;\n```\n\n### 2. API Response Optimization\n\n```javascript\n// Implement response compression\nconst compression = require('compression');\napp.use(compression());\n\n// Add response caching headers\napp.get('/api/products', (req, res) => {\n  res.set({\n    'Cache-Control': 'public, max-age=3600', // 1 hour\n    'ETag': generateETag(products),\n    'Last-Modified': lastModifiedDate\n  });\n  \n  res.json(products);\n});\n\n// Implement pagination\napp.get('/api/products', async (req, res) => {\n  const page = parseInt(req.query.page) || 1;\n  const limit = parseInt(req.query.limit) || 20;\n  const offset = (page - 1) * limit;\n  \n  const products = await Product.findAll({\n    limit,\n    offset,\n    order: [['created_at', 'DESC']]\n  });\n  \n  const total = await Product.count();\n  \n  res.json({\n    data: products,\n    pagination: {\n      page,\n      limit,\n      total,\n      pages: Math.ceil(total / limit)\n    }\n  });\n});\n```\n\n## Infrastructure Optimization\n\n### 1. CDN Configuration\n\n```javascript\n// CloudFront distribution settings\nconst distributionConfig = {\n  Origins: [{\n    DomainName: 'api.example.com',\n    CustomOriginConfig: {\n      HTTPPort: 443,\n      OriginProtocolPolicy: 'https-only'\n    }\n  }],\n  DefaultCacheBehavior: {\n    TargetOriginId: 'api-origin',\n    ViewerProtocolPolicy: 'redirect-to-https',\n    CachePolicyId: 'custom-cache-policy',\n    Compress: true\n  },\n  CacheBehaviors: [{\n    PathPattern: '/static/*',\n    CachePolicyId: 'static-assets-policy',\n    TTL: 31536000 // 1 year\n  }]\n};\n```\n\n### 2. Load Balancing\n\n```yaml\n# nginx.conf\nupstream app_servers {\n    least_conn;\n    server app1:3000 weight=3;\n    server app2:3000 weight=3;\n    server app3:3000 weight=2;\n}\n\nserver {\n    listen 80;\n    server_name example.com;\n    \n    location / {\n        proxy_pass http://app_servers;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_cache_bypass $http_upgrade;\n    }\n    \n    location /static/ {\n        expires 1y;\n        add_header Cache-Control "public, immutable";\n        root /var/www;\n    }\n}\n```\n\n## Monitoring and Alerting\n\n```javascript\n// Performance monitoring\nconst performanceObserver = new PerformanceObserver((list) => {\n  for (const entry of list.getEntries()) {\n    if (entry.entryType === 'navigation') {\n      analytics.track('Page Load Performance', {\n        loadTime: entry.loadEventEnd - entry.loadEventStart,\n        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,\n        firstPaint: entry.responseEnd - entry.requestStart\n      });\n    }\n  }\n});\n\nperformanceObserver.observe({ entryTypes: ['navigation', 'paint'] });\n```\n\nRemember: measure first, optimize second. Use real user monitoring to identify bottlenecks, then apply targeted optimizations that provide the biggest impact for your specific use case.	markdown	t	ai_response	\N	{"topics": ["performance", "optimization", "frontend", "backend"], "word_count": 1400, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 6}	{}	2025-10-08 21:18:09.981049+00	2025-10-08 21:18:09.981049+00
ded4e8e5-1bfd-4515-9894-a272e93a1f35	5dfb6f49-6497-4882-939e-1c12efb9ffc3	1	# Security Audit Checklist: Protecting Your Application\n\nA comprehensive security audit is essential for protecting your application and user data. This checklist covers the most critical security areas that every application should address.\n\n## Authentication and Authorization\n\n### ✅ Authentication Security\n\n- [ ] **Strong password policies** enforced (minimum 8 characters, complexity requirements)\n- [ ] **Multi-factor authentication** available for sensitive accounts\n- [ ] **Account lockout** after failed login attempts (5-10 attempts)\n- [ ] **Password reset** tokens expire within reasonable time (15-30 minutes)\n- [ ] **Session management** with secure cookies and proper expiration\n- [ ] **Brute force protection** implemented (rate limiting, CAPTCHA)\n\n### ✅ Authorization Controls\n\n- [ ] **Principle of least privilege** applied to all user roles\n- [ ] **Role-based access control** properly implemented\n- [ ] **API endpoints** protected with proper authentication\n- [ ] **Direct object references** validated (prevent IDOR attacks)\n- [ ] **Admin functions** require additional verification\n\n## Data Protection\n\n### ✅ Data Encryption\n\n```javascript\n// Encrypt sensitive data at rest\nconst crypto = require('crypto');\n\nconst encryptData = (text, key) => {\n  const algorithm = 'aes-256-gcm';\n  const iv = crypto.randomBytes(16);\n  const cipher = crypto.createCipher(algorithm, key, iv);\n  \n  let encrypted = cipher.update(text, 'utf8', 'hex');\n  encrypted += cipher.final('hex');\n  \n  const authTag = cipher.getAuthTag();\n  \n  return {\n    encrypted,\n    iv: iv.toString('hex'),\n    authTag: authTag.toString('hex')\n  };\n};\n```\n\n### ✅ Data Handling\n\n- [ ] **PII data** properly classified and protected\n- [ ] **Data retention** policies implemented\n- [ ] **Secure data deletion** when no longer needed\n- [ ] **Database encryption** enabled for sensitive tables\n- [ ] **Backup encryption** for all data backups\n- [ ] **Data masking** in non-production environments\n\n## Input Validation and Sanitization\n\n### ✅ SQL Injection Prevention\n\n```javascript\n// Use parameterized queries\nconst getUserById = async (userId) => {\n  // ✅ SECURE: Parameterized query\n  const query = 'SELECT * FROM users WHERE id = $1';\n  const result = await db.query(query, [userId]);\n  return result.rows[0];\n};\n\n// ❌ VULNERABLE: String concatenation\n// const query = `SELECT * FROM users WHERE id = ${userId}`;\n```\n\n### ✅ XSS Prevention\n\n```javascript\n// Sanitize user input\nconst DOMPurify = require('dompurify');\n\nconst sanitizeInput = (userInput) => {\n  return DOMPurify.sanitize(userInput, {\n    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],\n    ALLOWED_ATTR: []\n  });\n};\n\n// Content Security Policy headers\napp.use((req, res, next) => {\n  res.setHeader(\n    'Content-Security-Policy',\n    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"\n  );\n  next();\n});\n```\n\n### ✅ Input Validation Checklist\n\n- [ ] **All user inputs** validated on both client and server\n- [ ] **File uploads** restricted by type, size, and content\n- [ ] **Email addresses** properly validated\n- [ ] **URLs** validated before processing\n- [ ] **JSON payloads** size-limited and schema-validated\n\n## Network Security\n\n### ✅ HTTPS and Transport Security\n\n```javascript\n// Force HTTPS in production\napp.use((req, res, next) => {\n  if (process.env.NODE_ENV === 'production' && !req.secure) {\n    return res.redirect(301, `https://${req.headers.host}${req.url}`);\n  }\n  next();\n});\n\n// Security headers\nconst helmet = require('helmet');\napp.use(helmet({\n  hsts: {\n    maxAge: 31536000,\n    includeSubDomains: true,\n    preload: true\n  },\n  contentSecurityPolicy: {\n    directives: {\n      defaultSrc: ["'self'"],\n      styleSrc: ["'self'", "'unsafe-inline'"],\n      scriptSrc: ["'self'"],\n      imgSrc: ["'self'", "data:", "https:"],\n    },\n  },\n}));\n```\n\n### ✅ Network Security Checklist\n\n- [ ] **TLS 1.2+** enforced for all connections\n- [ ] **Certificate pinning** implemented for mobile apps\n- [ ] **CORS policies** properly configured\n- [ ] **Rate limiting** on all public endpoints\n- [ ] **DDoS protection** in place\n- [ ] **Firewall rules** restricting unnecessary ports\n\n## Infrastructure Security\n\n### ✅ Server Hardening\n\n```bash\n# Update system packages\nsudo apt update && sudo apt upgrade -y\n\n# Configure firewall\nsudo ufw default deny incoming\nsudo ufw default allow outgoing\nsudo ufw allow ssh\nsudo ufw allow 80\nsudo ufw allow 443\nsudo ufw enable\n\n# Disable unnecessary services\nsudo systemctl disable apache2\nsudo systemctl stop apache2\n\n# Set up fail2ban for SSH protection\nsudo apt install fail2ban\nsudo systemctl enable fail2ban\n```\n\n### ✅ Infrastructure Checklist\n\n- [ ] **Operating systems** kept up to date\n- [ ] **Unnecessary services** disabled\n- [ ] **SSH keys** used instead of passwords\n- [ ] **Regular security patches** applied\n- [ ] **Monitoring and logging** enabled\n- [ ] **Backup and recovery** procedures tested\n\n## Application Security\n\n### ✅ Dependency Management\n\n```bash\n# Audit npm dependencies\nnpm audit\nnpm audit fix\n\n# Use Snyk for continuous monitoring\nnpx snyk test\nnpx snyk monitor\n\n# Keep dependencies updated\nnpm outdated\nnpm update\n```\n\n### ✅ Error Handling\n\n```javascript\n// Secure error handling\napp.use((err, req, res, next) => {\n  // Log full error details internally\n  console.error(err.stack);\n  \n  // Return generic error to client\n  if (process.env.NODE_ENV === 'production') {\n    res.status(500).json({\n      error: 'Internal server error',\n      message: 'Something went wrong'\n    });\n  } else {\n    res.status(500).json({\n      error: err.message,\n      stack: err.stack\n    });\n  }\n});\n```\n\n## Compliance and Documentation\n\n### ✅ Compliance Checklist\n\n- [ ] **GDPR compliance** for EU users\n- [ ] **CCPA compliance** for California users\n- [ ] **Privacy policy** updated and accessible\n- [ ] **Terms of service** current\n- [ ] **Data processing agreements** with third parties\n- [ ] **Incident response plan** documented and tested\n\n## Security Testing\n\n### ✅ Regular Security Testing\n\n- [ ] **Automated security scanning** integrated into CI/CD\n- [ ] **Penetration testing** performed annually\n- [ ] **Code reviews** include security considerations\n- [ ] **Vulnerability assessments** conducted quarterly\n- [ ] **Security training** provided to development team\n\nRemember: security is not a one-time task but an ongoing process. Regular audits, updates, and monitoring are essential for maintaining a secure application.	markdown	t	ai_response	\N	{"topics": ["security", "audit", "checklist", "compliance"], "word_count": 1350, "content_type": "blog_post", "generated_by": "ai_agent", "reading_time_minutes": 6}	{}	2025-10-09 21:18:09.981049+00	2025-10-09 21:18:09.981049+00
\.


--
-- Data for Name: deliverables; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deliverables (id, user_id, conversation_id, project_step_id, agent_name, title, type, created_at, updated_at) FROM stdin;
1432230a-6eab-4001-8487-9d27809f37f6	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	\N	Dashboard Builder Agent	Dashboard Component Specification	specification	2025-09-30 19:48:09.981049+00	2025-09-30 20:48:09.981049+00
4816b176-aba8-4f82-a9cc-3929430e897a	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	\N	Authentication Agent	Authentication Implementation Guide	guide	2025-10-01 19:48:09.981049+00	2025-10-01 20:48:09.981049+00
60a1aefa-5dae-43b2-9682-3fae275da290	b29a590e-b07f-49df-a25b-574c956b5035	91642195-1f88-4f3d-a88d-bc5d05440f80	\N	Database Designer Agent	Database Schema Documentation	documentation	2025-10-02 19:48:09.981049+00	2025-10-02 20:48:09.981049+00
9f6ccb77-9b74-4531-8800-5dca05662230	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	\N	API Security Agent	Rate Limiting Strategy Document	strategy	2025-10-03 19:48:09.981049+00	2025-10-03 20:48:09.981049+00
0d2913b0-9775-4b0a-82a2-e69090e99555	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	\N	Mobile UX Agent	Mobile Navigation Wireframes	wireframes	2025-10-04 19:48:09.981049+00	2025-10-04 20:48:09.981049+00
c7aa1741-7264-4daf-8ac8-4913f3364267	b29a590e-b07f-49df-a25b-574c956b5035	c6741ed7-9003-4921-8dda-9aa6729f2916	\N	Payment Integration Agent	Payment Integration Setup Guide	guide	2025-10-05 19:48:09.981049+00	2025-10-05 20:48:09.981049+00
6ef02b65-cf27-4b78-a791-5f2e1b4e7065	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	\N	Email Template Agent	Email Template Design System	design_system	2025-10-06 19:48:09.981049+00	2025-10-06 20:48:09.981049+00
9735c935-af21-4d36-a568-a1e8f21d228d	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	\N	Search Optimization Agent	Search Algorithm Documentation	documentation	2025-10-07 19:48:09.981049+00	2025-10-07 20:48:09.981049+00
546aba1a-02a2-4d31-82ba-1518cec015f0	b29a590e-b07f-49df-a25b-574c956b5035	9e6f502b-ba20-4e24-88a7-0ce85149c18b	\N	Performance Agent	Performance Optimization Report	report	2025-10-08 19:48:09.981049+00	2025-10-08 20:48:09.981049+00
5dfb6f49-6497-4882-939e-1c12efb9ffc3	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	\N	Security Audit Agent	Security Audit Checklist	checklist	2025-10-09 19:48:09.981049+00	2025-10-09 20:48:09.981049+00
\.


--
-- Data for Name: human_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.human_approvals (id, organization_slug, agent_slug, conversation_id, task_id, mode, status, approved_by, decision_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: llm_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) FROM stdin;
gpt-5	openai	GPT-5	text-generation	\N	128000	8192	{}	{}	[]	fast-thinking	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
o4-mini	openai	o4-mini	text-generation	\N	32000	8192	{}	{}	[]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
o1-preview	openai	o1-preview	text-generation	\N	16000	4096	{}	{}	[]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
o1-mini	openai	o1-mini	text-generation	\N	8000	2048	{}	{}	[]	ultra-fast	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
gemini-2.5-pro	google	Gemini 2.5 Pro	text-generation	\N	1000000	8192	{}	{}	[]	fast-thinking	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
gemini-2.5-flash	google	Gemini 2.5 Flash	text-generation	\N	1000000	8192	{}	{}	[]	ultra-fast	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
gemini-2.0-pro	google	Gemini 2.0 Pro	text-generation	\N	1000000	8192	{}	{}	[]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
gemini-2.0-flash	google	Gemini 2.0 Flash	text-generation	\N	1048576	8192	{}	{}	[]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
claude-opus-4-1-20250805	anthropic	Claude Opus 4.1	text-generation	\N	200000	8192	{}	{"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075}	["function_calling", "streaming", "vision", "coding", "reasoning", "agentic"]	fast-thinking	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
claude-sonnet-4-20250514	anthropic	Claude Sonnet 4	text-generation	\N	200000	64000	{}	{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}	["function_calling", "streaming", "vision", "balanced", "high_output"]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
claude-3-5-haiku-20241022	anthropic	Claude 3.5 Haiku	text-generation	\N	200000	8192	{}	{"input_cost_per_token": 0.0008, "output_cost_per_token": 0.004}	["streaming", "fast", "low_latency", "cost_effective"]	ultra-fast	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
claude-3-5-sonnet-20241022	anthropic	Claude 3.5 Sonnet	text-generation	\N	200000	8192	{}	{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}	["function_calling", "streaming", "balanced", "reasoning"]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
grok-4	grok	Grok 4	text-generation	\N	128000	8192	{}	{"api_pricing": "custom", "monthly_cost": 40, "subscription_tier": "SuperGrok"}	["function_calling", "streaming", "tool_use", "real_time_search", "multimodal"]	fast-thinking	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
grok-4-heavy	grok	Grok 4 Heavy	text-generation	\N	256000	8192	{}	{"api_pricing": "custom", "monthly_cost": 120, "subscription_tier": "SuperGrok Heavy"}	["function_calling", "streaming", "tool_use", "max_accuracy", "enterprise"]	fast-thinking	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
grok-3	grok	Grok 3	text-generation	\N	128000	8192	{}	{"api_pricing": "custom", "monthly_cost": 20, "subscription_tier": "Standard Grok"}	["streaming", "reasoning", "think_mode"]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
grok-3-mini	grok	Grok 3 mini	text-generation	\N	64000	4096	{}	{"api_pricing": "low_cost", "subscription_tier": "included"}	["streaming", "fast", "lower_accuracy"]	ultra-fast	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
grok-code-fast-1	grok	Grok Code Fast 1	text-generation	\N	256000	8192	{}	{"pricing": "custom", "api_only": true, "specialized": "coding"}	["function_calling", "tool_use", "coding", "ide_integration", "agentic"]	general	medium	5	f	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
llama3.2:latest	ollama	Llama 3.2 Latest	text-generation	\N	128000	4096	{}	{"cost": 0, "local": true}	["streaming", "local", "open_source"]	general	medium	8	t	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
qwen3:8b	ollama	Qwen 3 8B	text-generation	\N	32000	4096	{}	{"cost": 0, "local": true}	["streaming", "local", "multilingual", "efficient"]	general	medium	7	t	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
deepseek-r1:latest	ollama	DeepSeek R1 Latest	text-generation	\N	64000	4096	{}	{"cost": 0, "local": true}	["streaming", "local", "reasoning", "coding"]	fast-thinking	medium	9	t	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
qwq:latest	ollama	QwQ Latest	text-generation	\N	32000	4096	{}	{"cost": 0, "local": true}	["streaming", "local", "reasoning"]	general	medium	5	t	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
gpt-oss:20b	ollama	GPT-OSS 20B	text-generation	\N	32000	4096	{}	{"cost": 0, "local": true}	["streaming", "local", "open_source", "efficient"]	ultra-fast	medium	8	t	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
phi3.5:latest	ollama	Phi 3.5 Latest	text-generation	\N	32000	4096	{}	{"cost": 0, "local": true}	["streaming", "local", "efficient"]	ultra-fast	medium	6	t	f	t	\N	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: llm_providers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) FROM stdin;
openai	OpenAI	https://api.openai.com/v1	{"timeout": 30, "max_retries": 3}	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
google	Google Gemini	https://generativelanguage.googleapis.com/v1	{"timeout": 30, "max_retries": 3}	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
anthropic	Anthropic Claude	https://api.anthropic.com/v1	{"timeout": 30, "max_retries": 3}	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
grok	Grok (xAI)	https://api.xai.com	{"timeout": 30, "max_retries": 3}	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
ollama	Ollama	http://localhost:11434	{"local": true, "timeout": 30, "max_retries": 3}	t	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: llm_usage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.llm_usage (id, run_id, user_id, conversation_id, provider_name, model_name, input_tokens, output_tokens, input_cost, output_cost, duration_ms, status, caller_type, agent_name, is_local, model_tier, fallback_used, routing_reason, complexity_level, complexity_score, data_classification, started_at, completed_at, error_message, data_sanitization_applied, sanitization_level, pii_detected, pii_types, pseudonyms_used, pseudonym_types, redactions_applied, redaction_types, source_blinding_applied, headers_stripped, custom_user_agent_used, proxy_used, no_train_header_sent, no_retain_header_sent, sanitization_time_ms, reversal_context_size, policy_profile, sovereign_mode, compliance_flags, created_at, route, total_cost, pseudonym_mappings) FROM stdin;
86812008-108b-48bc-a1ae-baefb6f68035	051577ee-fa1c-4c44-b902-739d226c804b	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	ollama	llama3.2:latest	175	305	0.002625	0.018300	1800	completed	api_call	task_agent	f	\N	f	\N	\N	\N	internal	2025-09-30 20:18:09.981049+00	2025-09-30 20:48:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-09-30 20:20:09.981049+00	\N	\N	[]
a278b674-ba9b-485e-b5cc-eb9e7b76c4ad	7d6e2760-2825-49f1-9922-0992ca843069	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	ollama	llama3.2:latest	200	335	0.003000	0.020100	1900	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	internal	2025-09-30 21:18:09.981049+00	2025-09-30 21:49:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-09-30 21:20:09.981049+00	\N	\N	[]
ff5a3d94-da37-4e5c-bf3a-eec9ed9f0639	81bd3a46-8cb5-4a7b-aeed-d4e8f0dff32b	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	ollama	llama3.2:latest	225	365	0.003375	0.021900	2000	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	internal	2025-09-30 22:18:09.981049+00	2025-09-30 22:51:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-09-30 22:20:09.981049+00	\N	\N	[]
9c22c6b2-d3b7-4d96-8d73-2f21cd91228f	ff6a8b19-d276-4974-a016-f196e8a128b9	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	ollama	llama3.2:latest	250	395	0.003750	0.023700	2100	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	internal	2025-09-30 23:18:09.981049+00	2025-09-30 23:53:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-09-30 23:20:09.981049+00	\N	\N	[]
1d360a2f-c5ba-4184-abaa-874df6bca2f4	7849239a-8647-48d7-8e51-88ad0b5296d7	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	ollama	llama3.2:latest	225	380	0.003375	0.022800	2000	completed	api_call	task_agent	f	\N	f	\N	\N	\N	confidential	2025-10-01 20:18:09.981049+00	2025-10-01 20:51:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-01 20:20:09.981049+00	\N	\N	[]
4b93e64f-2db0-4209-a66c-6c004e2b14ff	97ec3785-a97f-4ac7-89cc-c4c453db7934	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	ollama	llama3.2:latest	250	410	0.003750	0.024600	2100	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	confidential	2025-10-01 21:18:09.981049+00	2025-10-01 21:53:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-01 21:20:09.981049+00	\N	\N	[]
1c389a91-33ff-4ad5-a658-ed2eda7eff9b	12276bd6-be9a-43b1-8a94-a15f0f020ab1	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	ollama	llama3.2:latest	275	440	0.004125	0.026400	2200	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	confidential	2025-10-01 22:18:09.981049+00	2025-10-01 22:54:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-01 22:20:09.981049+00	\N	\N	[]
90fd3a1b-b8c4-47b6-8bd5-7f7690f56d87	d512bdbe-58cc-4f1a-b66b-b2152ede1436	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	ollama	llama3.2:latest	300	470	0.004500	0.028200	2300	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	confidential	2025-10-01 23:18:09.981049+00	2025-10-01 23:56:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-01 23:20:09.981049+00	\N	\N	[]
e706c313-beb4-4ee9-8abf-ce6dd4b9dc46	d96733e2-fa67-462a-83e8-062c3a8938bb	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	ollama	llama3.2:latest	325	500	0.004875	0.030000	2400	completed	background_task	task_agent	f	\N	f	\N	\N	\N	confidential	2025-10-02 00:18:09.981049+00	2025-10-02 00:58:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-02 00:20:09.981049+00	\N	\N	[]
10313e39-b2a4-4f1f-b078-515a65b27314	4a5fbbb3-0198-4fd3-b8c0-56c936729118	b29a590e-b07f-49df-a25b-574c956b5035	91642195-1f88-4f3d-a88d-bc5d05440f80	ollama	llama3.2:latest	275	455	0.004125	0.027300	2200	completed	api_call	task_agent	f	\N	f	\N	\N	\N	public	2025-10-02 20:18:09.981049+00	2025-10-02 20:54:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-02 20:20:09.981049+00	\N	\N	[]
bb78d26a-c4e9-4acb-b79f-78eab845c5e1	ee2df670-2cd0-4358-b8fa-d2fe27c100b2	b29a590e-b07f-49df-a25b-574c956b5035	91642195-1f88-4f3d-a88d-bc5d05440f80	ollama	llama3.2:latest	300	485	0.004500	0.029100	2300	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	public	2025-10-02 21:18:09.981049+00	2025-10-02 21:56:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-02 21:20:09.981049+00	\N	\N	[]
65c020e6-6583-42d1-8671-616d6d847803	3b0e18fa-3bb8-421a-8909-53d76a0fa2a8	b29a590e-b07f-49df-a25b-574c956b5035	91642195-1f88-4f3d-a88d-bc5d05440f80	ollama	llama3.2:latest	325	515	0.004875	0.030900	2400	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	public	2025-10-02 22:18:09.981049+00	2025-10-02 22:58:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-02 22:20:09.981049+00	\N	\N	[]
00715c6d-ec94-498b-a749-6b82b665096a	16e538d5-fad1-4220-89e1-120395e37fa2	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	ollama	llama3.2:latest	325	530	0.004875	0.031800	2400	completed	api_call	task_agent	f	\N	f	\N	\N	\N	internal	2025-10-03 20:18:09.981049+00	2025-10-03 20:58:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-03 20:20:09.981049+00	\N	\N	[]
ce233c46-f0a9-411f-a8ec-39f3fe4ac165	155c10c8-1ed7-49d3-b6fa-6b61f4048f26	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	ollama	llama3.2:latest	350	560	0.005250	0.033600	2500	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	internal	2025-10-03 21:18:09.981049+00	2025-10-03 21:59:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-03 21:20:09.981049+00	\N	\N	[]
9f4faedb-acea-402d-867b-03265eea8ea1	b44b6f96-f12f-4241-a058-9ae4347ce3b9	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	ollama	llama3.2:latest	375	590	0.005625	0.035400	2600	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	internal	2025-10-03 22:18:09.981049+00	2025-10-03 23:01:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-03 22:20:09.981049+00	\N	\N	[]
315f8ec8-fe49-49f8-b1ac-641a329eeb44	9334bc30-e07f-4879-9481-fe23eb63c5c0	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	ollama	llama3.2:latest	400	620	0.006000	0.037200	2700	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	internal	2025-10-03 23:18:09.981049+00	2025-10-04 00:03:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-03 23:20:09.981049+00	\N	\N	[]
c61662df-c591-4070-a1e0-9ed02612911f	91a824f6-3732-436f-b811-c99e9bb85886	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	ollama	llama3.2:latest	375	605	0.005625	0.036300	2600	completed	api_call	task_agent	f	\N	f	\N	\N	\N	confidential	2025-10-04 20:18:09.981049+00	2025-10-04 21:01:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-04 20:20:09.981049+00	\N	\N	[]
b62f7646-47eb-49ca-8932-dbf713730c4b	6e77df7f-887f-42ed-83b9-fc5dcad5cd3e	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	ollama	llama3.2:latest	400	635	0.006000	0.038100	2700	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	confidential	2025-10-04 21:18:09.981049+00	2025-10-04 22:03:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-04 21:20:09.981049+00	\N	\N	[]
1e457f23-9dec-4d19-8226-a95bde222333	1e7b20d1-8e9d-46d7-93d2-d1d92821484b	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	ollama	llama3.2:latest	425	665	0.006375	0.039900	2800	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	confidential	2025-10-04 22:18:09.981049+00	2025-10-04 23:04:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-04 22:20:09.981049+00	\N	\N	[]
21b71975-d509-4fd9-9a9b-3a47ec0d4842	f5c6ce2a-c12b-4403-80ff-4a64cfcb8cb3	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	ollama	llama3.2:latest	450	695	0.006750	0.041700	2900	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	confidential	2025-10-04 23:18:09.981049+00	2025-10-05 00:06:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-04 23:20:09.981049+00	\N	\N	[]
bb3e54e7-d60d-4d1c-a2ae-a424dea16164	1adc2a7e-4b45-48b5-abfa-d463a38ff17d	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	ollama	llama3.2:latest	475	725	0.007125	0.043500	3000	completed	background_task	task_agent	f	\N	f	\N	\N	\N	confidential	2025-10-05 00:18:09.981049+00	2025-10-05 01:08:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-05 00:20:09.981049+00	\N	\N	[]
040ab109-b41d-4a5d-a11f-27434f73be58	66bded80-91f5-468b-a866-a389f6cdabd3	b29a590e-b07f-49df-a25b-574c956b5035	c6741ed7-9003-4921-8dda-9aa6729f2916	ollama	llama3.2:latest	425	680	0.006375	0.040800	2800	completed	api_call	task_agent	f	\N	f	\N	\N	\N	public	2025-10-05 20:18:09.981049+00	2025-10-05 21:04:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-05 20:20:09.981049+00	\N	\N	[]
297f0d54-66a0-404c-90c2-3b1313a363c6	f2b9520a-38c8-4b8f-934b-fc80da8a84b3	b29a590e-b07f-49df-a25b-574c956b5035	c6741ed7-9003-4921-8dda-9aa6729f2916	ollama	llama3.2:latest	450	710	0.006750	0.042600	2900	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	public	2025-10-05 21:18:09.981049+00	2025-10-05 22:06:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-05 21:20:09.981049+00	\N	\N	[]
752d3fa5-c806-48df-8122-1d0ae594edc1	12cf8a2c-8317-4bed-a1da-3a8a2f93846b	b29a590e-b07f-49df-a25b-574c956b5035	c6741ed7-9003-4921-8dda-9aa6729f2916	ollama	llama3.2:latest	475	740	0.007125	0.044400	3000	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	public	2025-10-05 22:18:09.981049+00	2025-10-05 23:08:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-05 22:20:09.981049+00	\N	\N	[]
a943202b-c889-4340-be96-e31e65b0226e	28d0534a-ed0d-413c-8828-b48e4a8854bc	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	ollama	llama3.2:latest	475	755	0.007125	0.045300	3000	completed	api_call	task_agent	f	\N	f	\N	\N	\N	internal	2025-10-06 20:18:09.981049+00	2025-10-06 21:08:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-06 20:20:09.981049+00	\N	\N	[]
b325315b-0ae8-4e1d-8e2c-2ee16474365e	51a3019f-45fb-4b2f-b583-6f60e98274c7	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	ollama	llama3.2:latest	500	785	0.007500	0.047100	3100	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	internal	2025-10-06 21:18:09.981049+00	2025-10-06 22:09:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-06 21:20:09.981049+00	\N	\N	[]
f71824be-74db-4540-a8c8-dbc859135486	8a41038e-d7d7-43cb-81a1-31b6360a69f6	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	ollama	llama3.2:latest	525	815	0.007875	0.048900	3200	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	internal	2025-10-06 22:18:09.981049+00	2025-10-06 23:11:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-06 22:20:09.981049+00	\N	\N	[]
0ba389a7-9b73-448a-a2f3-d2df3c1f3f83	ed8046d9-ba95-4d82-b419-258214d7c292	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	ollama	llama3.2:latest	550	845	0.008250	0.050700	3300	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	internal	2025-10-06 23:18:09.981049+00	2025-10-07 00:13:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-06 23:20:09.981049+00	\N	\N	[]
fb2cc108-b4ee-4651-95db-651f1cf7e316	2dd7eaf6-97cd-4b10-b04a-b891b4b7e462	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	ollama	llama3.2:latest	525	830	0.007875	0.049800	3200	completed	api_call	task_agent	f	\N	f	\N	\N	\N	confidential	2025-10-07 20:18:09.981049+00	2025-10-07 21:11:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-07 20:20:09.981049+00	\N	\N	[]
df7505ab-0e63-4dfd-83bc-d6d977a0e1fe	cbb6f706-32c0-4e88-a4e5-bef81dc29d8a	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	ollama	llama3.2:latest	550	860	0.008250	0.051600	3300	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	confidential	2025-10-07 21:18:09.981049+00	2025-10-07 22:13:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-07 21:20:09.981049+00	\N	\N	[]
4463dbf6-14a2-4023-887a-d3fd2031969c	cb16a897-06c7-4e9e-8a28-8be8811af35e	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	ollama	llama3.2:latest	575	890	0.008625	0.053400	3400	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	confidential	2025-10-07 22:18:09.981049+00	2025-10-07 23:14:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-07 22:20:09.981049+00	\N	\N	[]
b0cb8865-46e1-498b-a51d-e14e942f5de9	10eb3fef-94e8-4c3d-a48d-d2642d5216a2	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	ollama	llama3.2:latest	600	920	0.009000	0.055200	3500	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	confidential	2025-10-07 23:18:09.981049+00	2025-10-08 00:16:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-07 23:20:09.981049+00	\N	\N	[]
c52bbdf9-b5eb-48d5-b98b-9bc36198ef82	2d6e12f7-6463-4aed-9aae-a443136db8ab	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	ollama	llama3.2:latest	625	950	0.009375	0.057000	3600	completed	background_task	task_agent	f	\N	f	\N	\N	\N	confidential	2025-10-08 00:18:09.981049+00	2025-10-08 01:18:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-08 00:20:09.981049+00	\N	\N	[]
0d311ad3-12b7-4c89-ada1-699a66fedd2d	c82e7fd7-ab47-4b25-b142-f8e9f5283ce9	b29a590e-b07f-49df-a25b-574c956b5035	9e6f502b-ba20-4e24-88a7-0ce85149c18b	ollama	llama3.2:latest	575	905	0.008625	0.054300	3400	completed	api_call	task_agent	f	\N	f	\N	\N	\N	public	2025-10-08 20:18:09.981049+00	2025-10-08 21:14:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-08 20:20:09.981049+00	\N	\N	[]
8910ee82-0092-46af-950d-80e7cfa76863	1e78a9f4-5982-4485-8eeb-9f587cb25ed9	b29a590e-b07f-49df-a25b-574c956b5035	9e6f502b-ba20-4e24-88a7-0ce85149c18b	ollama	llama3.2:latest	600	935	0.009000	0.056100	3500	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	public	2025-10-08 21:18:09.981049+00	2025-10-08 22:16:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-08 21:20:09.981049+00	\N	\N	[]
e18e1990-2495-4d1d-ae62-903f2dd2db51	8ffc2f08-8027-4552-91a0-76f6baccc6ab	b29a590e-b07f-49df-a25b-574c956b5035	9e6f502b-ba20-4e24-88a7-0ce85149c18b	ollama	llama3.2:latest	625	965	0.009375	0.057900	3600	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	public	2025-10-08 22:18:09.981049+00	2025-10-08 23:18:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-08 22:20:09.981049+00	\N	\N	[]
6ce003ab-211b-49bf-bb00-58aaef0541b5	6e2ceb37-5d28-4967-af48-bd4fe9267707	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	ollama	llama3.2:latest	625	980	0.009375	0.058800	3600	completed	api_call	task_agent	f	\N	f	\N	\N	\N	internal	2025-10-09 20:18:09.981049+00	2025-10-09 21:18:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-09 20:20:09.981049+00	\N	\N	[]
62137f06-6534-4aca-b2bf-a4b5b3eb9802	422a9e8d-7aef-4834-aaf6-288d14c52008	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	ollama	llama3.2:latest	650	1010	0.009750	0.060600	3700	completed	background_task	analysis_agent	f	\N	f	\N	\N	\N	internal	2025-10-09 21:18:09.981049+00	2025-10-09 22:19:49.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-09 21:20:09.981049+00	\N	\N	[]
998b1d66-6ce5-48c0-8396-428a4d24a9b5	860ff6bd-237f-4968-ac33-5b7e4814fb7d	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	ollama	llama3.2:latest	675	1040	0.010125	0.062400	3800	completed	web_interface	summary_agent	f	\N	f	\N	\N	\N	internal	2025-10-09 22:18:09.981049+00	2025-10-09 23:21:29.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-09 22:20:09.981049+00	\N	\N	[]
74511440-1396-46e4-9a84-e7849c0b2a33	eb2504ed-78ad-4b8b-8f43-7edd84c1c7c2	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	ollama	llama3.2:latest	700	1070	0.010500	0.064200	3900	completed	api_call	conversation_agent	f	\N	f	\N	\N	\N	internal	2025-10-09 23:18:09.981049+00	2025-10-10 00:23:09.981049+00	\N	f	none	f	[]	0	[]	0	[]	f	f	f	f	f	f	0	0	\N	f	[]	2025-10-09 23:20:09.981049+00	\N	\N	[]
aec5a8e4-dd8e-4426-98ac-83db85bd1042	ollama-1760039733926-i151s70t7	a1b2c3d4-e5f6-7890-abcd-ef1234567890	38ef70b5-1a48-4024-81f3-8c937f3dcea6	ollama	llama3.2:latest	103	524	\N	\N	5632	completed	agent	Blog Post Writer	t	local	f	\N	\N	\N	\N	2025-10-09 19:55:33.926+00	2025-10-09 19:55:39.558+00	\N	f	local-bypass	f	{}	0	[]	0	[]	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-10-09 19:55:39.564349+00	local	0	[]
c8cf1d16-77ec-4a19-a2f5-2992640ec87b	ollama-1760039752153-fr4bfnoks	a1b2c3d4-e5f6-7890-abcd-ef1234567890	38ef70b5-1a48-4024-81f3-8c937f3dcea6	ollama	gpt-oss:20b	115	1833	\N	\N	29545	completed	agent	Blog Post Writer	t	local	f	\N	\N	\N	\N	2025-10-09 19:55:52.153+00	2025-10-09 19:56:21.698+00	\N	f	local-bypass	f	{}	0	[]	0	[]	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-10-09 19:56:21.704581+00	local	0	[]
\.


--
-- Data for Name: orchestration_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orchestration_runs (id, plan_id, origin_type, origin_id, orchestration_slug, prompt_inputs, organization_slug, status, current_step_index, completed_steps, step_state, human_checkpoint_id, metadata, started_at, completed_at) FROM stdin;
\.


--
-- Data for Name: organization_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_credentials (id, organization_slug, alias, credential_type, encrypted_value, encryption_metadata, rotated_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plan_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plan_versions (id, plan_id, version_number, content, format, created_by_type, created_by_id, task_id, metadata, is_current_version, created_at) FROM stdin;
d8ecd3b4-8481-4564-a383-b46f5f18cd51	0459adf5-4c9f-4c1b-af2a-897d72fca33d	1	# How to Play Golf in the Rain: Tips, Gear, and Tricks for a Successful Wet Day\n\n*Meta description: Playing golf in the rain can be challenging, but with the right gear, strategy, and mindset, you can still enjoy a great round. Learn practical tips, gear recommendations, and mental hacks to keep your game on track when the skies open up.*\n\n---\n\n## Table of Contents\n\n1. [Why Golfing in the Rain Matters](#why-golfing-in-the-rain-matters)\n2. [Common Challenges of a Wet Round](#common-challenges-of-a-wet-round)\n3. [Essential Gear for Rainy Golf](#essential-gear-for-rainy-golf)\n4. [Pre‑Round Preparation](#pre-round-preparation)\n5. **Playing the Course in the Rain**  \n   5.1. [Club Selection & Ball Choice](#club-selection--ball-choice)  \n   5.2. [Swing Adjustments](#swing-adjustments)  \n   5.3. [Course Management](#course-management)  \n6. [Mental & Physical Tips](#mental--physical-tips)\n7. [After‑Game Recovery](#after-game-recovery)\n8. [Frequently Asked Questions](#frequently-asked-questions)\n9. [Conclusion](#conclusion)\n\n---\n\n## Why Golfing in the Rain Matters\n\nGolf is a sport that thrives on precision, consistency, and a calm mindset. Rain can disrupt all three, but it also offers unique opportunities:\n\n- **Improved Course Conditions** – Soft greens can reduce spin and help the ball stay on the fairway.\n- **Mental Challenge** – Adapting to wet conditions sharpens focus and resilience.\n- **Less Crowd** – Fewer players on the course can mean more space and less pressure.\n\nIf you’re a golfer who loves a challenge, mastering the rain can elevate your game.\n\n---\n\n## Common Challenges of a Wet Round\n\n| Challenge | Impact on Play | Why It Happens |\n|-----------|----------------|----------------|\n| **Wet Balls** | Reduced carry, more spin | Water increases ball spin and reduces launch |\n| **Slippery Clubs** | Poor grip, inconsistent swing | Moisture on hands and clubface |\n| **Soft Greens** | Slower roll, less reaction time | Turf becomes mushy and water‑logged |\n| **Wind & Visibility** | Unpredictable ball flight | Rain can amplify wind gusts and lower visibility |\n\nUnderstanding these hurdles is the first step toward overcoming them.\n\n---\n\n## Essential Gear for Rainy Golf\n\n| Item | Why It Matters | Tips |\n|------|----------------|------|\n| **Water‑Resistant Jacket & Pants** | Keeps you dry and comfortable | Look for breathable, quick‑dry fabrics |\n| **Windbreaker** | Protects against wind chill | Lightweight, packable |\n| **Golf Gloves (Water‑Proof)** | Maintains grip | Consider latex‑free or nitrile gloves with a textured palm |\n| **Rain‑Proof Golf Bag** | Protects clubs & electronics | Waterproof or water‑repellent material |\n| **Golf Ball with Low Spin** | Better performance in wet | Opt for “low spin” or “soft feel” models |\n| **Cap or Visor** | Shields eyes from rain | A brim that directs water away from your face |\n\n**Pro Tip:** Carry a spare glove and a small towel for quick dry‑downs between shots.\n\n---\n\n## Pre‑Round Preparation\n\n1. **Check the Forecast** – Use reliable weather apps or the course’s website for up‑to‑date rain predictions.\n2. **Inspect the Course** – Look for standing water, slushy greens, and potential hazards.\n3. **Warm‑Up Thoroughly** – A longer warm‑up helps loosen muscles and adjust to a slower swing tempo.\n4. **Plan Your Tee Shots** – Shorter, more accurate drives are safer when the ball doesn’t travel as far.\n\n---\n\n## Playing the Course in the Rain\n\n### 5.1 Club Selection & Ball Choice\n\n- **Shorter Clubs**: Use a club you’re comfortable with; the ball will carry less distance.\n- **Low‑Spin Balls**: Choose a ball that reduces backspin, giving you more control on the green.\n- **Avoid High‑Launch Shots**: The ball will tend to drop early; keep it low and controlled.\n\n### 5.2 Swing Adjustments\n\n| Adjustment | Effect | How to Execute |\n|------------|--------|----------------|\n| **Lower the Ball Position** | Reduces lift | Place the ball slightly forward in your stance |\n| **Shorter Tempo** | Prevents over‑swing | Focus on a smooth, controlled swing |\n| **Avoid Over‑Rotating the Clubface** | Limits spin | Keep the clubface square at impact |\n\n### 5.3 Course Management\n\n- **Play to the Wind**: In rain, wind can be more pronounced. Adjust your line accordingly.\n- **Choose the Safest Route**: Opt for the center of the fairway; avoid the edges where water can pool.\n- **Use the Greens Wisely**: Greens are slower; aim for a softer approach shot.\n\n---\n\n## Mental & Physical Tips\n\n| Tip | Why It Helps |\n|-----|--------------|\n| **Stay Positive** | A confident mindset improves focus and swing consistency. |\n| **Take Breaks** | Short pauses keep your body from getting too cold or stiff. |\n| **Stay Warm** | A warm body swings more efficiently; use hand warmers if needed. |\n| **Visualize the Shot** | Mentally picturing a smooth swing can help maintain rhythm. |\n\n---\n\n## After‑Game Recovery\n\n- **Dry Off**: Change into dry clothing as soon as possible to avoid chill.\n- **Hydrate**: Even if it’s raining, you’re still sweating. Drink water or a sports drink.\n- **Stretch**: Loosen the muscles you used, especially the back and shoulders.\n- **Reflect**: Note what worked and what didn’t. Use these insights for next time.\n\n---\n\n## Frequently Asked Questions\n\n| Question | Answer |\n|----------|--------|\n| **Can I play golf in heavy rain?** | It’s possible, but be cautious of water hazards and reduced visibility. |\n| **Do I need a golf umbrella?** | A golf umbrella is handy for shielding from rain, but many golfers prefer staying dry with proper gear. |\n| **How does rain affect putting?** | Greens are slower; use shorter, more controlled putts. |\n| **Is it safe to play in a downpour?** | Only if the course is open and there are no flooding hazards. |\n\n---\n\n## Conclusion\n\nPlaying golf in the rain isn’t just about enduring wet conditions—it’s an opportunity to sharpen your skills, adapt your strategy, and enjoy the game in a new light. With the right gear, thoughtful preparation, and a resilient mindset, you can turn a rainy round into a memorable one. So next time the clouds roll in, grab your waterproof jacket, adjust your swing, and let the rain add an extra layer of excitement to your game!\n\n---\n\n**Ready to tackle the rain?** Download our free *Rainy Golf Checklist* and stay prepared for every wet round.	markdown	agent	\N	e03d95f2-780b-4bcc-9e8c-337e43e4e994	{"usage": {"cost": 0, "inputTokens": 115, "totalTokens": 1948, "outputTokens": 1833}, "llmModel": "gpt-oss:20b", "llmProvider": "ollama"}	t	2025-10-09 19:56:21.727516+00
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans (id, conversation_id, user_id, agent_name, namespace, title, current_version_id, created_at, updated_at, plan_json, organization_slug) FROM stdin;
0459adf5-4c9f-4c1b-af2a-897d72fca33d	38ef70b5-1a48-4024-81f3-8c937f3dcea6	a1b2c3d4-e5f6-7890-abcd-ef1234567890	blog_post_writer	my-org	Plan from blog_post_writer	d8ecd3b4-8481-4564-a383-b46f5f18cd51	2025-10-09 19:56:21.715793+00	2025-10-09 19:56:21.731403+00	{}	\N
\.


--
-- Data for Name: pseudonym_dictionaries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at) FROM stdin;
71a5a8b4-b4b8-450c-bf39-563868c485df	Matt Weber	@person_matt	name	person	1	t	2025-10-09 19:18:09.981049+00	\N	\N	2025-10-09 19:18:09.981049+00
ef159156-1fdb-4b23-91d7-881295637d85	GolferGeek	@user_golfer	username	person	1	t	2025-10-09 19:18:09.981049+00	\N	\N	2025-10-09 19:18:09.981049+00
f2973a02-a6c3-4f66-a5c8-8936132d7423	Orchestrator AI	@company_orchestrator	custom	business	1	t	2025-10-09 19:18:09.981049+00	\N	\N	2025-10-09 19:18:09.981049+00
\.


--
-- Data for Name: redaction_patterns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.redaction_patterns (id, name, pattern_regex, replacement, description, category, priority, is_active, severity, data_type, created_at, updated_at) FROM stdin;
341ef90b-9d43-4e62-9101-a27326426c53	email_standard	\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b	[EMAIL_REDACTED]	Standard email addresses	pii_builtin	10	t	pseudonymizer	email	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
3d9398a4-57f0-417f-b922-f1f5c67beed0	email_obfuscated	\\b[A-Za-z0-9._%+-]+\\s+(?:at|AT)\\s+[A-Za-z0-9.-]+\\s+(?:dot|DOT)\\s+[A-Za-z]{2,}\\b	[EMAIL_REDACTED]	Obfuscated email addresses (john at company dot com)	pii_builtin	20	t	pseudonymizer	email	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
33132eef-ea6a-4d1d-9d5e-48ffec414876	phone_us_standard	\\b(?:\\+?1[-.\\s]?)?\\(?([0-9]{3})\\)?[-.\\s]?([0-9]{3})[-.\\s]?([0-9]{4})\\b	[PHONE_REDACTED]	US phone numbers (various formats)	pii_builtin	10	t	pseudonymizer	phone	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
abe851d2-3787-425e-9083-2aa104062504	phone_international	\\+(?:[0-9] ?){6,14}[0-9]	[PHONE_REDACTED]	International phone numbers	pii_builtin	15	t	pseudonymizer	phone	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
bae7fe12-65b0-4260-bfed-f01a1c2f3141	name_first_last	\\b[A-Z][a-z]{1,}(?: [A-Z][a-z]{1,}){1,3}\\b	[NAME_REDACTED]	First and last names (Title case)	pii_builtin	30	t	flagger	name	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
cf2e1877-0a75-47ae-89e2-effa17adbf84	ip_address_v4	\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b	[IP_REDACTED]	IPv4 addresses	pii_builtin	10	t	flagger	ip_address	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
b71cd833-50d1-47fe-adde-97f586cb53e9	ip_address_v6	\\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\\b	[IP_REDACTED]	IPv6 addresses (full format)	pii_builtin	15	t	flagger	ip_address	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
d7d4061a-663a-4e0e-a9e2-948076b84a64	ssn_standard	\\b\\d{3}-\\d{2}-\\d{4}\\b	[SSN_REDACTED]	Social Security Numbers (XXX-XX-XXXX)	pii_builtin	5	t	showstopper	ssn	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
65f0bef1-8e51-4676-98ed-9d7dba107f74	ssn_no_dashes	\\b\\d{9}\\b	[SSN_REDACTED]	Social Security Numbers (no dashes)	pii_builtin	5	t	showstopper	ssn	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
c3eb0ef9-1327-4f12-9e89-87bf160ad330	credit_card_visa	\\b4[0-9]{12}(?:[0-9]{3})?\\b	[CREDIT_CARD_REDACTED]	Visa credit card numbers	pii_builtin	5	t	showstopper	credit_card	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
50c0194f-8e98-4088-9df4-e81acd3257fd	credit_card_mastercard	\\b5[1-5][0-9]{14}\\b	[CREDIT_CARD_REDACTED]	Mastercard credit card numbers	pii_builtin	5	t	showstopper	credit_card	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
107de532-eb6d-497b-ab48-f93acb3a5a57	credit_card_amex	\\b3[47][0-9]{13}\\b	[CREDIT_CARD_REDACTED]	American Express credit card numbers	pii_builtin	5	t	showstopper	credit_card	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
1ab30adc-1bea-4218-bdcf-7dbe190c3bcf	credit_card_discover	\\b6(?:011|5[0-9]{2})[0-9]{12}\\b	[CREDIT_CARD_REDACTED]	Discover credit card numbers	pii_builtin	5	t	showstopper	credit_card	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
b12753b0-2576-4d66-b2dc-eef95d3585c2	username_handle	\\b@[a-zA-Z0-9_]{3,15}\\b	[USERNAME_REDACTED]	Social media usernames/handles	pii_builtin	40	t	flagger	username	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
a5fe587d-92b3-4e3c-b0dd-1350343e3071	address_us_street	\\b\\d{1,5}\\s+[A-Za-z0-9\\s]{3,}\\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court)\\b	[ADDRESS_REDACTED]	US street addresses	pii_builtin	25	t	pseudonymizer	address	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
96d31f42-dbdd-47d4-a3f0-ffde9186bec4	github_token	\\bgh[pousr]_[A-Za-z0-9]{36}\\b	[GITHUB_TOKEN_REDACTED]	GitHub personal access tokens	pii_builtin	1	t	showstopper	custom	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
df60793f-38ae-43bf-ad95-78e335e9853f	aws_access_key	\\bAKIA[0-9A-Z]{16}\\b	[AWS_ACCESS_KEY_REDACTED]	AWS access key IDs	pii_builtin	1	t	showstopper	custom	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
4dd46b68-2e67-4622-87a6-1dd37b1a094b	jwt_token	\\beyJ[A-Za-z0-9+/=]+\\.[A-Za-z0-9+/=]+\\.[A-Za-z0-9+/=]+\\b	[JWT_TOKEN_REDACTED]	JSON Web Tokens	pii_builtin	1	t	showstopper	custom	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
acfee6fd-ab89-4e14-9d5a-a28505c6f070	bearer_token	\\b[Bb]earer\\s+[A-Za-z0-9+/]{20,}	[BEARER_TOKEN_REDACTED]	Bearer tokens	pii_builtin	1	t	showstopper	custom	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
ace352ca-febf-4a98-bde6-6dbaf1553ba2	openai_api_key	\\bsk-[A-Za-z0-9]{48,}\\b	[OPENAI_API_KEY_REDACTED]	OpenAI API keys	pii_builtin	1	t	showstopper	custom	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
b26fefa9-e760-4ec8-b557-fff8ad0b9401	stripe_key	\\bsk_(?:test|live)_[A-Za-z0-9]{24,}\\b	[STRIPE_KEY_REDACTED]	Stripe API keys	pii_builtin	1	t	showstopper	custom	2025-10-09 19:18:09.981049+00	2025-10-09 19:30:53.889306+00
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (key, value, updated_at) FROM stdin;
model_config_global	{"model": "gpt-4o", "provider": "openai", "parameters": {"maxTokens": 800, "temperature": 0.2}}	2025-10-09 19:30:53.888433+00
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, user_id, conversation_id, method, params, prompt, response, status, progress, progress_message, error_code, error_message, error_data, started_at, completed_at, timeout_seconds, deliverable_type, deliverable_metadata, metadata, llm_metadata, response_metadata, evaluation, created_at, updated_at) FROM stdin;
61640b8a-caba-43ab-bdec-98453ad5314d	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-09-30 20:18:09.981049+00	2025-09-30 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 5}	{}	{}	\N	2025-09-30 20:18:09.981049+00	2025-09-30 20:23:09.981049+00
f4566b4a-943a-46fd-a185-d157889b37a0	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Implementation in progress...	in_progress	0	\N	\N	\N	\N	2025-09-30 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 9}	{}	{}	\N	2025-09-30 21:18:09.981049+00	2025-09-30 21:23:09.981049+00
d6af0651-e748-4ee5-ac78-f1a76eec7961	b29a590e-b07f-49df-a25b-574c956b5035	66f858b9-0d63-4afa-9052-10b661543c05	add_testing_validation	{}	Create comprehensive test suite and implement validation rules	Writing tests...	in_progress	0	\N	\N	\N	\N	2025-09-30 22:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 13}	{}	{}	\N	2025-09-30 22:18:09.981049+00	2025-09-30 22:23:09.981049+00
c6c5b821-0be0-45a0-b141-85cead82895b	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-01 20:18:09.981049+00	2025-10-01 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 6}	{}	{}	\N	2025-10-01 20:18:09.981049+00	2025-10-01 20:23:09.981049+00
0c74fe67-8e66-48de-a4de-a75655c3f660	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	implement_core_functionality	{}	Develop the main features and business logic according to specifications		pending	0	\N	\N	\N	\N	2025-10-01 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 10}	{}	{}	\N	2025-10-01 21:18:09.981049+00	2025-10-01 21:23:09.981049+00
e0722690-81c5-48ba-bc4c-6e57012e9379	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	add_testing_validation	{}	Create comprehensive test suite and implement validation rules		pending	0	\N	\N	\N	\N	2025-10-01 22:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 14}	{}	{}	\N	2025-10-01 22:18:09.981049+00	2025-10-01 22:23:09.981049+00
59465d43-6a15-4049-b9d2-fcfabcc73184	b29a590e-b07f-49df-a25b-574c956b5035	5931a44f-506e-4377-b637-bf5bdfe79e8b	deploy_and_monitor	{}	Deploy to production environment and set up monitoring systems		pending	0	\N	\N	\N	\N	2025-10-01 23:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "deployment"], "title": "Deploy and monitor", "priority": "low", "complexity": "medium", "estimated_hours": 18}	{}	{}	\N	2025-10-01 23:18:09.981049+00	2025-10-01 23:23:09.981049+00
27868440-e9eb-4fc6-a034-a608bbdb3cdd	b29a590e-b07f-49df-a25b-574c956b5035	91642195-1f88-4f3d-a88d-bc5d05440f80	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-02 20:18:09.981049+00	2025-10-02 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 4}	{}	{}	\N	2025-10-02 20:18:09.981049+00	2025-10-02 20:23:09.981049+00
4c167f29-5068-49ba-b47c-acd6b2b948fb	b29a590e-b07f-49df-a25b-574c956b5035	91642195-1f88-4f3d-a88d-bc5d05440f80	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Core functionality implemented and tested.	completed	0	\N	\N	\N	\N	2025-10-02 21:18:09.981049+00	2025-10-02 22:03:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 8}	{}	{}	\N	2025-10-02 21:18:09.981049+00	2025-10-02 21:23:09.981049+00
d45f04ec-cffa-45a9-a09d-4b359dd573c4	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-03 20:18:09.981049+00	2025-10-03 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 5}	{}	{}	\N	2025-10-03 20:18:09.981049+00	2025-10-03 20:23:09.981049+00
d6cebc12-a83a-436a-98b4-47284dfb7232	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Implementation in progress...	in_progress	0	\N	\N	\N	\N	2025-10-03 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 9}	{}	{}	\N	2025-10-03 21:18:09.981049+00	2025-10-03 21:23:09.981049+00
f79aa939-e466-4ab4-8e88-2173a7de6c13	b29a590e-b07f-49df-a25b-574c956b5035	2e536d84-d5c8-4c2e-bf58-436b5d7dd493	add_testing_validation	{}	Create comprehensive test suite and implement validation rules	Testing suite completed with 95% coverage.	completed	0	\N	\N	\N	\N	2025-10-03 22:18:09.981049+00	2025-10-03 23:18:09.981049+00	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 13}	{}	{}	\N	2025-10-03 22:18:09.981049+00	2025-10-03 22:23:09.981049+00
b8d1877c-731b-4376-a2cd-bee8d315b05a	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-04 20:18:09.981049+00	2025-10-04 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 6}	{}	{}	\N	2025-10-04 20:18:09.981049+00	2025-10-04 20:23:09.981049+00
63127da0-6085-49ba-a637-076ebb208057	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	implement_core_functionality	{}	Develop the main features and business logic according to specifications		pending	0	\N	\N	\N	\N	2025-10-04 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 10}	{}	{}	\N	2025-10-04 21:18:09.981049+00	2025-10-04 21:23:09.981049+00
219ebe7f-1c98-406f-abb2-92d471b63ad9	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	add_testing_validation	{}	Create comprehensive test suite and implement validation rules	Writing tests...	in_progress	0	\N	\N	\N	\N	2025-10-04 22:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 14}	{}	{}	\N	2025-10-04 22:18:09.981049+00	2025-10-04 22:23:09.981049+00
b794ea77-e824-41f7-a2a2-6d997487cbbd	b29a590e-b07f-49df-a25b-574c956b5035	bff9ce60-05b5-42fb-b508-8bf3b973aadd	deploy_and_monitor	{}	Deploy to production environment and set up monitoring systems		pending	0	\N	\N	\N	\N	2025-10-04 23:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "deployment"], "title": "Deploy and monitor", "priority": "low", "complexity": "medium", "estimated_hours": 18}	{}	{}	\N	2025-10-04 23:18:09.981049+00	2025-10-04 23:23:09.981049+00
c7043128-b431-4ea1-855c-0cf8068fce6e	b29a590e-b07f-49df-a25b-574c956b5035	c6741ed7-9003-4921-8dda-9aa6729f2916	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-05 20:18:09.981049+00	2025-10-05 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 4}	{}	{}	\N	2025-10-05 20:18:09.981049+00	2025-10-05 20:23:09.981049+00
231baab1-9e85-4bc3-8255-3603ddfaa160	b29a590e-b07f-49df-a25b-574c956b5035	c6741ed7-9003-4921-8dda-9aa6729f2916	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Core functionality implemented and tested.	completed	0	\N	\N	\N	\N	2025-10-05 21:18:09.981049+00	2025-10-05 22:03:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 8}	{}	{}	\N	2025-10-05 21:18:09.981049+00	2025-10-05 21:23:09.981049+00
889f7526-8536-44df-a2df-9fdef6ae779a	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-06 20:18:09.981049+00	2025-10-06 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 5}	{}	{}	\N	2025-10-06 20:18:09.981049+00	2025-10-06 20:23:09.981049+00
da454747-12f6-4bc7-be20-47a8d80f930d	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Implementation in progress...	in_progress	0	\N	\N	\N	\N	2025-10-06 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 9}	{}	{}	\N	2025-10-06 21:18:09.981049+00	2025-10-06 21:23:09.981049+00
7d803fce-554b-4327-a16a-605367afcc7c	b29a590e-b07f-49df-a25b-574c956b5035	70afc481-1bbd-4c2f-9bf7-68dfbc2dc3ee	add_testing_validation	{}	Create comprehensive test suite and implement validation rules		pending	0	\N	\N	\N	\N	2025-10-06 22:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 13}	{}	{}	\N	2025-10-06 22:18:09.981049+00	2025-10-06 22:23:09.981049+00
4bbc6a43-51b6-4310-9228-78f0d7191d4b	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-07 20:18:09.981049+00	2025-10-07 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 6}	{}	{}	\N	2025-10-07 20:18:09.981049+00	2025-10-07 20:23:09.981049+00
3dd0bf9e-1e2e-404e-9842-91d879812a0c	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	implement_core_functionality	{}	Develop the main features and business logic according to specifications		pending	0	\N	\N	\N	\N	2025-10-07 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 10}	{}	{}	\N	2025-10-07 21:18:09.981049+00	2025-10-07 21:23:09.981049+00
a811897e-fa12-44c4-9075-d6eda229229d	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	add_testing_validation	{}	Create comprehensive test suite and implement validation rules	Testing suite completed with 95% coverage.	completed	0	\N	\N	\N	\N	2025-10-07 22:18:09.981049+00	2025-10-07 23:18:09.981049+00	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 14}	{}	{}	\N	2025-10-07 22:18:09.981049+00	2025-10-07 22:23:09.981049+00
87283827-959e-4d5f-a343-5f59deac2214	b29a590e-b07f-49df-a25b-574c956b5035	d6671925-606e-462b-ae7c-66f46bf3f1b4	deploy_and_monitor	{}	Deploy to production environment and set up monitoring systems		pending	0	\N	\N	\N	\N	2025-10-07 23:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "deployment"], "title": "Deploy and monitor", "priority": "low", "complexity": "medium", "estimated_hours": 18}	{}	{}	\N	2025-10-07 23:18:09.981049+00	2025-10-07 23:23:09.981049+00
32878a73-2dfd-4020-987b-6c8279897f57	b29a590e-b07f-49df-a25b-574c956b5035	9e6f502b-ba20-4e24-88a7-0ce85149c18b	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-08 20:18:09.981049+00	2025-10-08 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 4}	{}	{}	\N	2025-10-08 20:18:09.981049+00	2025-10-08 20:23:09.981049+00
bb343d22-89fa-4169-beb9-4c19e26bb024	b29a590e-b07f-49df-a25b-574c956b5035	9e6f502b-ba20-4e24-88a7-0ce85149c18b	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Core functionality implemented and tested.	completed	0	\N	\N	\N	\N	2025-10-08 21:18:09.981049+00	2025-10-08 22:03:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 8}	{}	{}	\N	2025-10-08 21:18:09.981049+00	2025-10-08 21:23:09.981049+00
07a0ff32-f04d-4318-a343-b00600a499c7	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	setup_project_structure	{}	Initialize project with proper folder structure, dependencies, and configuration files	Project structure initialized successfully with all required dependencies and configuration files.	completed	0	\N	\N	\N	\N	2025-10-09 20:18:09.981049+00	2025-10-09 20:48:09.981049+00	300	\N	\N	{"tags": ["development", "implementation"], "title": "Setup project structure", "priority": "high", "complexity": "low", "estimated_hours": 5}	{}	{}	\N	2025-10-09 20:18:09.981049+00	2025-10-09 20:23:09.981049+00
5bb531c7-9c93-4ec3-a30a-0976cfc4b802	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	implement_core_functionality	{}	Develop the main features and business logic according to specifications	Implementation in progress...	in_progress	0	\N	\N	\N	\N	2025-10-09 21:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "implementation"], "title": "Implement core functionality", "priority": "high", "complexity": "high", "estimated_hours": 9}	{}	{}	\N	2025-10-09 21:18:09.981049+00	2025-10-09 21:23:09.981049+00
55ad747b-2e53-472b-9d02-17e388d27d41	b29a590e-b07f-49df-a25b-574c956b5035	9cfb3f53-02c6-4951-8e04-0fb624fad0e7	add_testing_validation	{}	Create comprehensive test suite and implement validation rules		pending	0	\N	\N	\N	\N	2025-10-09 22:18:09.981049+00	\N	300	\N	\N	{"tags": ["development", "testing"], "title": "Add testing and validation", "priority": "medium", "complexity": "medium", "estimated_hours": 13}	{}	{}	\N	2025-10-09 22:18:09.981049+00	2025-10-09 22:23:09.981049+00
7e13cb15-80a5-4380-bb7a-2660ba6a733f	a1b2c3d4-e5f6-7890-abcd-ef1234567890	38ef70b5-1a48-4024-81f3-8c937f3dcea6	converse	{"method": "converse", "prompt": "can you write a blog post about playing golf in the rain?", "metadata": {"jsonrpc": {"id": "7e13cb15-80a5-4380-bb7a-2660ba6a733f", "method": "converse"}, "protocol": "a2a-google", "llmSelection": {"maxTokens": 800, "modelName": "gpt-4o", "temperature": 0.2, "providerName": "openai"}, "conversationHistory": [{"role": "assistant", "content": "Hello! I'm the Blog Post Writer. How can I help you today?", "timestamp": "2025-10-09T19:55:19.016Z"}, {"role": "user", "content": "can you write a blog post about playing golf in the rain?", "timestamp": "2025-10-09T19:55:19.016Z"}]}, "conversationId": "38ef70b5-1a48-4024-81f3-8c937f3dcea6"}	can you write a blog post about playing golf in the rain?	{"success":true,"mode":"converse","payload":{"content":{"message":"**Playing Golf in the Rain: A Guide for Wet Weather Enthusiasts**\\n=================================================================\\n\\nAs the sun beats down on the course, many of us look forward to a refreshing round of golf on a rainy day. But is it really possible to enjoy this sport in the midst of a downpour? With the right mindset and techniques, playing golf in the rain can be just as enjoyable as on a sunny day.\\n\\n**The Benefits of Playing Golf in the Rain**\\n------------------------------------------\\n\\nWhile some might view rain-soaked courses as a hindrance to golfing, we believe that there's something special about playing in the wet. For one, the reduced crowds mean less competition for tee times and more opportunities to practice your game. Additionally, the misty veil that shrouds the course creates an eerie yet serene atmosphere that can be quite invigorating.\\n\\n**Preparing Your Gear for Rainy Golf**\\n-----------------------------------------\\n\\nBefore you step onto the course, make sure your gear is up to the task:\\n\\n*   **Golf shoes with good traction**: You'll want footwear that can grip the wet grass, reducing the risk of slipping and falling.\\n*   **Waterproof pants or a rain jacket**: Keeping dry and comfortable is key when playing in the rain. Look for clothing with breathable membranes to prevent overheating.\\n*   **A waterproof ball marker and divot tool**: These small accessories will help you mark your ball's position on the green, even when it's submerged.\\n\\n**Tips for Playing Golf in the Rain**\\n--------------------------------------\\n\\nNow that you're equipped with the right gear, here are some expert tips for navigating the course in wet conditions:\\n\\n*   **Take slower swings**: A rain-soaked clubhead will have less grip and momentum than a dry one. Take your time to ensure accuracy and control.\\n*   **Choose the right clubs**: Select clubs that can handle the moisture, such as fairway woods or hybrids, which tend to be less affected by wet conditions.\\n*   **Pay attention to drainage**: Make sure you're playing on parts of the course with good drainage. Avoid low-lying areas where water may collect.\\n\\n**Conclusion**\\n----------\\n\\nPlaying golf in the rain requires a bit more finesse and patience than playing on dry days, but it can also be incredibly rewarding. With the right mindset and techniques, you'll find that this wet weather sport has its unique charm. So next time the skies grow dark, grab your gear and hit the course – the misty veil is waiting for you!\\n\\n---\\n\\nHow was that? Would you like me to make any changes or create a new post?"},"metadata":{"provider":"ollama","model":"llama3.2:latest","usage":{"inputTokens":103,"outputTokens":524,"totalTokens":627,"cost":0},"routingDecision":{"provider":"ollama","model":"llama3.2:latest","isLocal":true,"modelTier":"general","fallbackUsed":false,"complexityScore":6,"reasoningPath":["Sovereign routing feature flag: DISABLED - using legacy routing","PII Detection: COMPLETED","Found 1 PII matches","External provider - creating pseudonym instructions","Complexity analysis: medium (score: 6)","Selected tier: general","Attempting local-first routing","Selected local model: llama3.2:latest"],"sovereignModeEnforced":false,"sovereignModeViolation":false,"piiMetadata":{"piiDetected":true,"showstopperDetected":false,"detectionResults":{"totalMatches":1,"flaggedMatches":[{"value":"Blog Post Writer","dataType":"name","severity":"info","confidence":1,"startIndex":120,"endIndex":136,"pattern":"name_first_last"}],"dataTypesSummary":{"name":{"count":1,"severity":"info","examples":["Blo..."]}},"severityBreakdown":{"showstopper":0,"warning":0,"info":1}},"policyDecision":{"allowed":true,"blocked":false,"violations":[],"reasoningPath":["PII Detection: COMPLETED","Found 1 PII matches","External provider - creating pseudonym instructions"],"appliedFor":"external"},"pseudonymInstructions":{"shouldPseudonymize":false,"targetMatches":[],"requestId":"38ef70b5-1a48-4024-81f3-8c937f3dcea6","context":"llm-boundary"},"userMessage":{"summary":"1 piece of personal information detected","details":["Detected: Name","Information flagged for monitoring but not modified"],"actionsTaken":["Request sent to AI model with monitoring","No modifications made to your content"],"isBlocked":false},"processingFlow":"pseudonymized","processingSteps":["pii-detection","external-provider-check","pseudonym-instructions-created"],"timestamps":{"detectionStart":1760039719026,"policyCheck":1760039719030}},"originalPrompt":"User message: can you write a blog post about playing golf in the rain?\\n\\nRecent transcript:\\n[assistant] \\"Hello! I'm the Blog Post Writer. How can I help you today?\\"\\n[user] \\"can you write a blog post about playing golf in the rain?\\"","routeToAgent":true},"metadata":{"agentId":"61ed59b0-ebb1-4f87-98d1-2df4c21d9509","agentSlug":"blog_post_writer","agentType":"context","modeProfile":"specialist_full","organizationSlug":"my-org","jsonrpc":{"id":"7e13cb15-80a5-4380-bb7a-2660ba6a733f","method":"converse"},"userId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","createdBy":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","taskId":"7e13cb15-80a5-4380-bb7a-2660ba6a733f"}}}}	completed	0	\N	\N	\N	\N	\N	2025-10-09 19:55:39.571+00	300	\N	\N	{}	{}	{}	\N	2025-10-09 19:55:19.01902+00	2025-10-09 19:55:39.571+00
e03d95f2-780b-4bcc-9e8c-337e43e4e994	a1b2c3d4-e5f6-7890-abcd-ef1234567890	38ef70b5-1a48-4024-81f3-8c937f3dcea6	plan	{"method": "plan", "prompt": "can you write a blog post about playing golf in the rain?", "metadata": {"jsonrpc": {"id": "e03d95f2-780b-4bcc-9e8c-337e43e4e994", "method": "plan.create"}, "protocol": "a2a-google", "conversationHistory": []}, "conversationId": "38ef70b5-1a48-4024-81f3-8c937f3dcea6"}	can you write a blog post about playing golf in the rain?	{"success":true,"mode":"plan","payload":{"content":{"plan":{"id":"0459adf5-4c9f-4c1b-af2a-897d72fca33d","conversationId":"38ef70b5-1a48-4024-81f3-8c937f3dcea6","userId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","agentName":"blog_post_writer","namespace":"my-org","title":"Plan from blog_post_writer","currentVersionId":"d8ecd3b4-8481-4564-a383-b46f5f18cd51","createdAt":"2025-10-09T19:56:21.715Z","updatedAt":"2025-10-09T19:56:21.731Z","currentVersion":{"id":"d8ecd3b4-8481-4564-a383-b46f5f18cd51","planId":"0459adf5-4c9f-4c1b-af2a-897d72fca33d","versionNumber":1,"content":"# How to Play Golf in the Rain: Tips, Gear, and Tricks for a Successful Wet Day\\n\\n*Meta description: Playing golf in the rain can be challenging, but with the right gear, strategy, and mindset, you can still enjoy a great round. Learn practical tips, gear recommendations, and mental hacks to keep your game on track when the skies open up.*\\n\\n---\\n\\n## Table of Contents\\n\\n1. [Why Golfing in the Rain Matters](#why-golfing-in-the-rain-matters)\\n2. [Common Challenges of a Wet Round](#common-challenges-of-a-wet-round)\\n3. [Essential Gear for Rainy Golf](#essential-gear-for-rainy-golf)\\n4. [Pre‑Round Preparation](#pre-round-preparation)\\n5. **Playing the Course in the Rain**  \\n   5.1. [Club Selection & Ball Choice](#club-selection--ball-choice)  \\n   5.2. [Swing Adjustments](#swing-adjustments)  \\n   5.3. [Course Management](#course-management)  \\n6. [Mental & Physical Tips](#mental--physical-tips)\\n7. [After‑Game Recovery](#after-game-recovery)\\n8. [Frequently Asked Questions](#frequently-asked-questions)\\n9. [Conclusion](#conclusion)\\n\\n---\\n\\n## Why Golfing in the Rain Matters\\n\\nGolf is a sport that thrives on precision, consistency, and a calm mindset. Rain can disrupt all three, but it also offers unique opportunities:\\n\\n- **Improved Course Conditions** – Soft greens can reduce spin and help the ball stay on the fairway.\\n- **Mental Challenge** – Adapting to wet conditions sharpens focus and resilience.\\n- **Less Crowd** – Fewer players on the course can mean more space and less pressure.\\n\\nIf you’re a golfer who loves a challenge, mastering the rain can elevate your game.\\n\\n---\\n\\n## Common Challenges of a Wet Round\\n\\n| Challenge | Impact on Play | Why It Happens |\\n|-----------|----------------|----------------|\\n| **Wet Balls** | Reduced carry, more spin | Water increases ball spin and reduces launch |\\n| **Slippery Clubs** | Poor grip, inconsistent swing | Moisture on hands and clubface |\\n| **Soft Greens** | Slower roll, less reaction time | Turf becomes mushy and water‑logged |\\n| **Wind & Visibility** | Unpredictable ball flight | Rain can amplify wind gusts and lower visibility |\\n\\nUnderstanding these hurdles is the first step toward overcoming them.\\n\\n---\\n\\n## Essential Gear for Rainy Golf\\n\\n| Item | Why It Matters | Tips |\\n|------|----------------|------|\\n| **Water‑Resistant Jacket & Pants** | Keeps you dry and comfortable | Look for breathable, quick‑dry fabrics |\\n| **Windbreaker** | Protects against wind chill | Lightweight, packable |\\n| **Golf Gloves (Water‑Proof)** | Maintains grip | Consider latex‑free or nitrile gloves with a textured palm |\\n| **Rain‑Proof Golf Bag** | Protects clubs & electronics | Waterproof or water‑repellent material |\\n| **Golf Ball with Low Spin** | Better performance in wet | Opt for “low spin” or “soft feel” models |\\n| **Cap or Visor** | Shields eyes from rain | A brim that directs water away from your face |\\n\\n**Pro Tip:** Carry a spare glove and a small towel for quick dry‑downs between shots.\\n\\n---\\n\\n## Pre‑Round Preparation\\n\\n1. **Check the Forecast** – Use reliable weather apps or the course’s website for up‑to‑date rain predictions.\\n2. **Inspect the Course** – Look for standing water, slushy greens, and potential hazards.\\n3. **Warm‑Up Thoroughly** – A longer warm‑up helps loosen muscles and adjust to a slower swing tempo.\\n4. **Plan Your Tee Shots** – Shorter, more accurate drives are safer when the ball doesn’t travel as far.\\n\\n---\\n\\n## Playing the Course in the Rain\\n\\n### 5.1 Club Selection & Ball Choice\\n\\n- **Shorter Clubs**: Use a club you’re comfortable with; the ball will carry less distance.\\n- **Low‑Spin Balls**: Choose a ball that reduces backspin, giving you more control on the green.\\n- **Avoid High‑Launch Shots**: The ball will tend to drop early; keep it low and controlled.\\n\\n### 5.2 Swing Adjustments\\n\\n| Adjustment | Effect | How to Execute |\\n|------------|--------|----------------|\\n| **Lower the Ball Position** | Reduces lift | Place the ball slightly forward in your stance |\\n| **Shorter Tempo** | Prevents over‑swing | Focus on a smooth, controlled swing |\\n| **Avoid Over‑Rotating the Clubface** | Limits spin | Keep the clubface square at impact |\\n\\n### 5.3 Course Management\\n\\n- **Play to the Wind**: In rain, wind can be more pronounced. Adjust your line accordingly.\\n- **Choose the Safest Route**: Opt for the center of the fairway; avoid the edges where water can pool.\\n- **Use the Greens Wisely**: Greens are slower; aim for a softer approach shot.\\n\\n---\\n\\n## Mental & Physical Tips\\n\\n| Tip | Why It Helps |\\n|-----|--------------|\\n| **Stay Positive** | A confident mindset improves focus and swing consistency. |\\n| **Take Breaks** | Short pauses keep your body from getting too cold or stiff. |\\n| **Stay Warm** | A warm body swings more efficiently; use hand warmers if needed. |\\n| **Visualize the Shot** | Mentally picturing a smooth swing can help maintain rhythm. |\\n\\n---\\n\\n## After‑Game Recovery\\n\\n- **Dry Off**: Change into dry clothing as soon as possible to avoid chill.\\n- **Hydrate**: Even if it’s raining, you’re still sweating. Drink water or a sports drink.\\n- **Stretch**: Loosen the muscles you used, especially the back and shoulders.\\n- **Reflect**: Note what worked and what didn’t. Use these insights for next time.\\n\\n---\\n\\n## Frequently Asked Questions\\n\\n| Question | Answer |\\n|----------|--------|\\n| **Can I play golf in heavy rain?** | It’s possible, but be cautious of water hazards and reduced visibility. |\\n| **Do I need a golf umbrella?** | A golf umbrella is handy for shielding from rain, but many golfers prefer staying dry with proper gear. |\\n| **How does rain affect putting?** | Greens are slower; use shorter, more controlled putts. |\\n| **Is it safe to play in a downpour?** | Only if the course is open and there are no flooding hazards. |\\n\\n---\\n\\n## Conclusion\\n\\nPlaying golf in the rain isn’t just about enduring wet conditions—it’s an opportunity to sharpen your skills, adapt your strategy, and enjoy the game in a new light. With the right gear, thoughtful preparation, and a resilient mindset, you can turn a rainy round into a memorable one. So next time the clouds roll in, grab your waterproof jacket, adjust your swing, and let the rain add an extra layer of excitement to your game!\\n\\n---\\n\\n**Ready to tackle the rain?** Download our free *Rainy Golf Checklist* and stay prepared for every wet round.","format":"markdown","createdByType":"agent","createdById":null,"taskId":"e03d95f2-780b-4bcc-9e8c-337e43e4e994","metadata":{"usage":{"cost":0,"inputTokens":115,"totalTokens":1948,"outputTokens":1833},"llmModel":"gpt-oss:20b","llmProvider":"ollama"},"isCurrentVersion":true,"createdAt":"2025-10-09T19:56:21.727Z"}},"version":{"id":"d8ecd3b4-8481-4564-a383-b46f5f18cd51","planId":"0459adf5-4c9f-4c1b-af2a-897d72fca33d","versionNumber":1,"content":"# How to Play Golf in the Rain: Tips, Gear, and Tricks for a Successful Wet Day\\n\\n*Meta description: Playing golf in the rain can be challenging, but with the right gear, strategy, and mindset, you can still enjoy a great round. Learn practical tips, gear recommendations, and mental hacks to keep your game on track when the skies open up.*\\n\\n---\\n\\n## Table of Contents\\n\\n1. [Why Golfing in the Rain Matters](#why-golfing-in-the-rain-matters)\\n2. [Common Challenges of a Wet Round](#common-challenges-of-a-wet-round)\\n3. [Essential Gear for Rainy Golf](#essential-gear-for-rainy-golf)\\n4. [Pre‑Round Preparation](#pre-round-preparation)\\n5. **Playing the Course in the Rain**  \\n   5.1. [Club Selection & Ball Choice](#club-selection--ball-choice)  \\n   5.2. [Swing Adjustments](#swing-adjustments)  \\n   5.3. [Course Management](#course-management)  \\n6. [Mental & Physical Tips](#mental--physical-tips)\\n7. [After‑Game Recovery](#after-game-recovery)\\n8. [Frequently Asked Questions](#frequently-asked-questions)\\n9. [Conclusion](#conclusion)\\n\\n---\\n\\n## Why Golfing in the Rain Matters\\n\\nGolf is a sport that thrives on precision, consistency, and a calm mindset. Rain can disrupt all three, but it also offers unique opportunities:\\n\\n- **Improved Course Conditions** – Soft greens can reduce spin and help the ball stay on the fairway.\\n- **Mental Challenge** – Adapting to wet conditions sharpens focus and resilience.\\n- **Less Crowd** – Fewer players on the course can mean more space and less pressure.\\n\\nIf you’re a golfer who loves a challenge, mastering the rain can elevate your game.\\n\\n---\\n\\n## Common Challenges of a Wet Round\\n\\n| Challenge | Impact on Play | Why It Happens |\\n|-----------|----------------|----------------|\\n| **Wet Balls** | Reduced carry, more spin | Water increases ball spin and reduces launch |\\n| **Slippery Clubs** | Poor grip, inconsistent swing | Moisture on hands and clubface |\\n| **Soft Greens** | Slower roll, less reaction time | Turf becomes mushy and water‑logged |\\n| **Wind & Visibility** | Unpredictable ball flight | Rain can amplify wind gusts and lower visibility |\\n\\nUnderstanding these hurdles is the first step toward overcoming them.\\n\\n---\\n\\n## Essential Gear for Rainy Golf\\n\\n| Item | Why It Matters | Tips |\\n|------|----------------|------|\\n| **Water‑Resistant Jacket & Pants** | Keeps you dry and comfortable | Look for breathable, quick‑dry fabrics |\\n| **Windbreaker** | Protects against wind chill | Lightweight, packable |\\n| **Golf Gloves (Water‑Proof)** | Maintains grip | Consider latex‑free or nitrile gloves with a textured palm |\\n| **Rain‑Proof Golf Bag** | Protects clubs & electronics | Waterproof or water‑repellent material |\\n| **Golf Ball with Low Spin** | Better performance in wet | Opt for “low spin” or “soft feel” models |\\n| **Cap or Visor** | Shields eyes from rain | A brim that directs water away from your face |\\n\\n**Pro Tip:** Carry a spare glove and a small towel for quick dry‑downs between shots.\\n\\n---\\n\\n## Pre‑Round Preparation\\n\\n1. **Check the Forecast** – Use reliable weather apps or the course’s website for up‑to‑date rain predictions.\\n2. **Inspect the Course** – Look for standing water, slushy greens, and potential hazards.\\n3. **Warm‑Up Thoroughly** – A longer warm‑up helps loosen muscles and adjust to a slower swing tempo.\\n4. **Plan Your Tee Shots** – Shorter, more accurate drives are safer when the ball doesn’t travel as far.\\n\\n---\\n\\n## Playing the Course in the Rain\\n\\n### 5.1 Club Selection & Ball Choice\\n\\n- **Shorter Clubs**: Use a club you’re comfortable with; the ball will carry less distance.\\n- **Low‑Spin Balls**: Choose a ball that reduces backspin, giving you more control on the green.\\n- **Avoid High‑Launch Shots**: The ball will tend to drop early; keep it low and controlled.\\n\\n### 5.2 Swing Adjustments\\n\\n| Adjustment | Effect | How to Execute |\\n|------------|--------|----------------|\\n| **Lower the Ball Position** | Reduces lift | Place the ball slightly forward in your stance |\\n| **Shorter Tempo** | Prevents over‑swing | Focus on a smooth, controlled swing |\\n| **Avoid Over‑Rotating the Clubface** | Limits spin | Keep the clubface square at impact |\\n\\n### 5.3 Course Management\\n\\n- **Play to the Wind**: In rain, wind can be more pronounced. Adjust your line accordingly.\\n- **Choose the Safest Route**: Opt for the center of the fairway; avoid the edges where water can pool.\\n- **Use the Greens Wisely**: Greens are slower; aim for a softer approach shot.\\n\\n---\\n\\n## Mental & Physical Tips\\n\\n| Tip | Why It Helps |\\n|-----|--------------|\\n| **Stay Positive** | A confident mindset improves focus and swing consistency. |\\n| **Take Breaks** | Short pauses keep your body from getting too cold or stiff. |\\n| **Stay Warm** | A warm body swings more efficiently; use hand warmers if needed. |\\n| **Visualize the Shot** | Mentally picturing a smooth swing can help maintain rhythm. |\\n\\n---\\n\\n## After‑Game Recovery\\n\\n- **Dry Off**: Change into dry clothing as soon as possible to avoid chill.\\n- **Hydrate**: Even if it’s raining, you’re still sweating. Drink water or a sports drink.\\n- **Stretch**: Loosen the muscles you used, especially the back and shoulders.\\n- **Reflect**: Note what worked and what didn’t. Use these insights for next time.\\n\\n---\\n\\n## Frequently Asked Questions\\n\\n| Question | Answer |\\n|----------|--------|\\n| **Can I play golf in heavy rain?** | It’s possible, but be cautious of water hazards and reduced visibility. |\\n| **Do I need a golf umbrella?** | A golf umbrella is handy for shielding from rain, but many golfers prefer staying dry with proper gear. |\\n| **How does rain affect putting?** | Greens are slower; use shorter, more controlled putts. |\\n| **Is it safe to play in a downpour?** | Only if the course is open and there are no flooding hazards. |\\n\\n---\\n\\n## Conclusion\\n\\nPlaying golf in the rain isn’t just about enduring wet conditions—it’s an opportunity to sharpen your skills, adapt your strategy, and enjoy the game in a new light. With the right gear, thoughtful preparation, and a resilient mindset, you can turn a rainy round into a memorable one. So next time the clouds roll in, grab your waterproof jacket, adjust your swing, and let the rain add an extra layer of excitement to your game!\\n\\n---\\n\\n**Ready to tackle the rain?** Download our free *Rainy Golf Checklist* and stay prepared for every wet round.","format":"markdown","createdByType":"agent","createdById":null,"taskId":"e03d95f2-780b-4bcc-9e8c-337e43e4e994","metadata":{"usage":{"cost":0,"inputTokens":115,"totalTokens":1948,"outputTokens":1833},"llmModel":"gpt-oss:20b","llmProvider":"ollama"},"isCurrentVersion":true,"createdAt":"2025-10-09T19:56:21.727Z"},"isNew":true},"metadata":{"provider":"ollama","model":"gpt-oss:20b","usage":{"inputTokens":115,"outputTokens":1833,"totalTokens":1948,"cost":0},"routingDecision":{"provider":"ollama","model":"gpt-oss:20b","isLocal":true,"modelTier":"ultra-fast","fallbackUsed":false,"complexityScore":3,"reasoningPath":["Sovereign routing feature flag: DISABLED - using legacy routing","PII Detection: COMPLETED","Found 0 PII matches","External provider - creating pseudonym instructions","Complexity analysis: simple (score: 3)","Selected tier: ultra-fast","Attempting local-first routing","Selected local model: gpt-oss:20b"],"sovereignModeEnforced":false,"sovereignModeViolation":false,"piiMetadata":{"piiDetected":false,"showstopperDetected":false,"detectionResults":{"totalMatches":0,"flaggedMatches":[],"dataTypesSummary":{},"severityBreakdown":{"showstopper":0,"warning":0,"info":0}},"policyDecision":{"allowed":true,"blocked":false,"violations":[],"reasoningPath":["PII Detection: COMPLETED","Found 0 PII matches","External provider - creating pseudonym instructions"],"appliedFor":"external"},"pseudonymInstructions":{"shouldPseudonymize":false,"targetMatches":[],"requestId":"38ef70b5-1a48-4024-81f3-8c937f3dcea6","context":"llm-boundary"},"userMessage":{"summary":"No personal information detected","details":[],"actionsTaken":["Request sent to AI model without modifications"],"isBlocked":false},"processingFlow":"pseudonymized","processingSteps":["pii-detection","external-provider-check","pseudonym-instructions-created"],"timestamps":{"detectionStart":1760039747052,"policyCheck":1760039747052}},"originalPrompt":"User message: can you write a blog post about playing golf in the rain?","routeToAgent":true}}}}	completed	0	\N	\N	\N	\N	\N	2025-10-09 19:56:21.739+00	300	\N	\N	{}	{}	{}	\N	2025-10-09 19:55:47.049813+00	2025-10-09 19:56:21.739+00
5c588e10-433a-4cbc-a130-499a70918670	a1b2c3d4-e5f6-7890-abcd-ef1234567890	c01c1680-25a0-4bde-a648-e367a4a480d7	build	{"method": "build", "prompt": "need an image of a golfer", "metadata": {"jsonrpc": {"id": "5c588e10-433a-4cbc-a130-499a70918670", "method": "build"}, "protocol": "a2a-google", "llmSelection": {"modelName": "gpt-oss:20b", "temperature": 0.7, "providerName": "ollama", "cidafmOptions": {"customOptions": {"customModifiers": []}, "executedCommands": [], "responseModifiers": [], "activeStateModifiers": []}}, "conversationHistory": [{"role": "assistant", "content": "Hello! I'm the Image Google Generator. How can I help you today?", "timestamp": "2025-10-09T20:21:22.072Z"}, {"role": "user", "content": "need an image of a golfer", "timestamp": "2025-10-09T20:21:22.072Z"}]}, "conversationId": "c01c1680-25a0-4bde-a648-e367a4a480d7"}	need an image of a golfer	{"success":false,"mode":"build","payload":{"content":{},"metadata":{"reason":"function_execution_failed"}}}	completed	0	\N	\N	\N	\N	\N	2025-10-09 20:21:27.262+00	300	\N	\N	{}	{}	{}	\N	2025-10-09 20:21:22.077346+00	2025-10-09 20:21:27.262+00
9d42f8bf-4847-463f-ab54-44d27dd8c1fd	a1b2c3d4-e5f6-7890-abcd-ef1234567890	c01c1680-25a0-4bde-a648-e367a4a480d7	build	{"method": "build", "prompt": "try again", "metadata": {"jsonrpc": {"id": "9d42f8bf-4847-463f-ab54-44d27dd8c1fd", "method": "build"}, "protocol": "a2a-google", "llmSelection": {"modelName": "gemini-2.5-flash", "temperature": 0.7, "providerName": "google", "cidafmOptions": {"customOptions": {"customModifiers": []}, "executedCommands": [], "responseModifiers": [], "activeStateModifiers": []}}, "conversationHistory": [{"role": "assistant", "content": "Hello! I'm the Image Google Generator. How can I help you today?", "timestamp": "2025-10-09T20:22:04.536Z"}, {"role": "user", "content": "need an image of a golfer", "timestamp": "2025-10-09T20:22:04.536Z"}, {"role": "assistant", "content": "{\\n  \\"success\\": false,\\n  \\"mode\\": \\"build\\",\\n  \\"payload\\": {\\n    \\"content\\": {},\\n    \\"metadata\\": {\\n      \\"reason\\": \\"function_execution_failed\\"\\n    }\\n  }\\n}", "timestamp": "2025-10-09T20:22:04.536Z"}, {"role": "user", "content": "try again", "timestamp": "2025-10-09T20:22:04.536Z"}]}, "conversationId": "c01c1680-25a0-4bde-a648-e367a4a480d7"}	try again	{"success":false,"mode":"build","payload":{"content":{},"metadata":{"reason":"function_execution_failed"}}}	completed	0	\N	\N	\N	\N	\N	2025-10-09 20:22:05.448+00	300	\N	\N	{}	{}	{}	\N	2025-10-09 20:22:04.541589+00	2025-10-09 20:22:05.448+00
\.


--
-- Data for Name: user_cidafm_commands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_cidafm_commands (id, user_id, command_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, display_name, role, roles, created_at, updated_at, namespace_access, status, organization_slug) FROM stdin;
b29a590e-b07f-49df-a25b-574c956b5035	demo.user@orchestratorai.io	Demo User	\N	["user"]	2025-10-09 19:18:09.981049+00	2025-10-09 19:18:09.981049+00	["demo"]	active	\N
a1b2c3d4-e5f6-7890-abcd-ef1234567890	admin@orchestratorai.io	Admin User	\N	["user", "admin"]	2025-10-09 19:28:38.367404+00	2025-10-09 19:28:38.367404+00	["demo", "my-org"]	active	\N
c4d5e6f7-8901-2345-6789-abcdef012345	golfergeek@orchestratorai.io	GolferGeek	\N	["user", "admin"]	2025-10-09 19:28:38.367404+00	2025-10-09 19:28:38.367404+00	["my-org"]	active	\N
\.


--
-- Name: auth_provider_sync_history_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.auth_provider_sync_history_id_seq', 1, false);


--
-- Name: execution_annotations_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.execution_annotations_id_seq', 1, false);


--
-- Name: execution_entity_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.execution_entity_id_seq', 1, false);


--
-- Name: execution_metadata_temp_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.execution_metadata_temp_id_seq', 1, false);


--
-- Name: insights_by_period_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.insights_by_period_id_seq', 1, false);


--
-- Name: insights_metadata_metaId_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n."insights_metadata_metaId_seq"', 1, false);


--
-- Name: insights_raw_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.insights_raw_id_seq', 1, false);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: n8n; Owner: -
--

SELECT pg_catalog.setval('n8n.migrations_id_seq', 99, true);


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
-- Name: conversations agent_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT agent_conversations_pkey PRIMARY KEY (id);


--
-- Name: agent_orchestrations agent_orchestrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_orchestrations
    ADD CONSTRAINT agent_orchestrations_pkey PRIMARY KEY (id);


--
-- Name: agent_orchestrations agent_orchestrations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_orchestrations
    ADD CONSTRAINT agent_orchestrations_slug_unique UNIQUE (organization_slug, agent_slug, slug);


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
-- Name: orchestration_runs orchestration_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orchestration_runs
    ADD CONSTRAINT orchestration_runs_pkey PRIMARY KEY (id);


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
-- Name: idx_migration_metadata_synced; Type: INDEX; Schema: n8n; Owner: -
--

CREATE INDEX idx_migration_metadata_synced ON n8n.migration_metadata USING btree (synced_at);


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
-- Name: idx_agent_orchestrations_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_orchestrations_agent ON public.agent_orchestrations USING btree (agent_slug);


--
-- Name: idx_agent_orchestrations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_orchestrations_org ON public.agent_orchestrations USING btree (organization_slug);


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
-- Name: idx_llm_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_created_at ON public.llm_usage USING btree (created_at);


--
-- Name: idx_llm_usage_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_run_id ON public.llm_usage USING btree (run_id);


--
-- Name: idx_orchestration_runs_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orchestration_runs_plan ON public.orchestration_runs USING btree (plan_id);


--
-- Name: idx_org_credentials_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_credentials_org ON public.organization_credentials USING btree (organization_slug);


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


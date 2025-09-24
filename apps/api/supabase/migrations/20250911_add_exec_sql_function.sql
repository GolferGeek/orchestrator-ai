-- Create a helper RPC function to execute arbitrary read-only SQL and return rows as JSONB
-- This supports both parameter names used in our codebase: "query" and "sql_query".
-- It returns SETOF jsonb so PostgREST/Supabase RPC returns an array of JSON objects.

-- Safety notes:
-- - Intended for development/test usage and controlled internal tools
-- - The function is SECURITY DEFINER; ensure RLS/permissions are configured appropriately in non-dev environments

create or replace function public.exec_sql(
  query text default null,
  sql_query text default null
)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
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

-- Grant execute to standard Supabase roles
grant execute on function public.exec_sql(text, text) to anon, authenticated;


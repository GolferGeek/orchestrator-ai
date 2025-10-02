-- Seed OpenAI and Google image function agents under my-org
BEGIN;

DO $$
DECLARE
  rec RECORD;
  payload jsonb;
BEGIN
  -- Seed OpenAI image generator
  SELECT * INTO rec FROM public.agents WHERE organization_slug = 'my-org' AND slug = 'image_openai_generator' LIMIT 1;
  IF NOT FOUND THEN
    payload := jsonb_build_object(
      'metadata', jsonb_build_object(
        'type','function',
        'category','image',
        'displayName','OpenAI Image Generator',
        'description','Generates images via OpenAI provider'
      ),
      'hierarchy', jsonb_build_object(
        'reports_to','image_orchestrator',
        'department','images'
      ),
      'capabilities', jsonb_build_array('image_generation'),
      'input_modes', jsonb_build_array('text/plain'),
      'output_modes', jsonb_build_array('image/png','image/jpeg','application/json'),
      'configuration', jsonb_build_object(
        'execution_profile','full_cycle',
        'execution_capabilities', jsonb_build_object('can_plan', false, 'can_build', true, 'requires_human_gate', false),
        'function', jsonb_build_object(
          'language','js',
          'version','1',
          'timeout_ms',20000,
          'code',
          $CODE$async function handler(input, ctx) {
  const { prompt, size = '512x512', n = 1, deliverableId = null } = input || {};
  const out = await ctx.services.images.generate({ prompt, size, n, title: 'OpenAI Images', provider: 'openai', deliverableId });
  return out;
}$CODE$
        )
      )
    );
    INSERT INTO public.agents (
      organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, agent_card, context, config
    ) VALUES (
      'my-org',
      'image_openai_generator',
      'OpenAI Image Generator',
      'Generates images via OpenAI function handler',
      'function',
      'full_cycle',
      '1.0.0',
      'active',
      payload::text,
      NULL,
      '{}',
      (payload - 'metadata')
    );
  END IF;

  -- Seed Google image generator (Gemini/Imagen)
  SELECT * INTO rec FROM public.agents WHERE organization_slug = 'my-org' AND slug = 'image_google_generator' LIMIT 1;
  IF NOT FOUND THEN
    payload := jsonb_build_object(
      'metadata', jsonb_build_object(
        'type','function',
        'category','image',
        'displayName','Google Image Generator',
        'description','Generates images via Google (Gemini/Imagen) provider'
      ),
      'hierarchy', jsonb_build_object(
        'reports_to','image_orchestrator',
        'department','images'
      ),
      'capabilities', jsonb_build_array('image_generation'),
      'input_modes', jsonb_build_array('text/plain'),
      'output_modes', jsonb_build_array('image/png','image/jpeg','application/json'),
      'configuration', jsonb_build_object(
        'execution_profile','full_cycle',
        'execution_capabilities', jsonb_build_object('can_plan', false, 'can_build', true, 'requires_human_gate', false),
        'function', jsonb_build_object(
          'language','js',
          'version','1',
          'timeout_ms',20000,
          'code',
          $CODE$async function handler(input, ctx) {
  const { prompt, size = '512x512', n = 1, deliverableId = null } = input || {};
  const out = await ctx.services.images.generate({ prompt, size, n, title: 'Google Images', provider: 'gemini', deliverableId });
  return out;
}$CODE$
        )
      )
    );
    INSERT INTO public.agents (
      organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, agent_card, context, config
    ) VALUES (
      'my-org',
      'image_google_generator',
      'Google Image Generator',
      'Generates images via Google (Gemini/Imagen) function handler',
      'function',
      'full_cycle',
      '1.0.0',
      'active',
      payload::text,
      NULL,
      '{}',
      (payload - 'metadata')
    );
  END IF;
END$$;

COMMIT;

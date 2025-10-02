-- Seed Image Orchestrator function agent under my-org
BEGIN;

DO $$
DECLARE
  rec RECORD;
  payload jsonb;
BEGIN
  SELECT * INTO rec FROM public.agents WHERE organization_slug = 'my-org' AND slug = 'image_orchestrator' LIMIT 1;
  IF NOT FOUND THEN
    payload := jsonb_build_object(
      'metadata', jsonb_build_object(
        'type','function',
        'category','image',
        'displayName','Image Orchestrator',
        'description','Fans out image generation across multiple providers'
      ),
      'hierarchy', jsonb_build_object(
        'department','images',
        'team', jsonb_build_array('image_openai_generator','image_google_generator')
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
  const { prompt, size = '512x512', n = 1, providers = ['openai','gemini'], deliverableId = null } = input || {};
  let last = null;
  for (const p of providers) {
    last = await ctx.services.images.generate({ prompt, size, n, title: 'Image Orchestrator', provider: p, deliverableId });
  }
  return last;
}$CODE$
        )
      )
    );

    INSERT INTO public.agents (
      organization_slug, slug, display_name, description, agent_type, mode_profile, version, status, yaml, agent_card, context, config
    ) VALUES (
      'my-org',
      'image_orchestrator',
      'Image Orchestrator',
      'Fan-out image generation to multiple providers',
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

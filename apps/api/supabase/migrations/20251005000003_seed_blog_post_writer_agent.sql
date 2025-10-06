-- Seed blog_post_writer agent for testing strict A2A protocol
-- This agent is used in plan-mode, build-mode, and converse-mode API tests

INSERT INTO public.agents (
  organization_slug,
  slug,
  display_name,
  description,
  agent_type,
  mode_profile,
  status,
  yaml
) VALUES (
  'my-org',
  'blog_post_writer',
  'Blog Post Writer',
  'Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.',
  'context',
  'plan-build-converse',
  'active',
  '
name: blog_post_writer
display_name: Blog Post Writer
description: Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.
agent_type: context
mode_profile: plan-build-converse
version: "1.0"
status: active

system_prompt: |
  Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.

  When creating a plan for a blog post, structure it with the following sections:

  # Blog Post Plan

  ## Title & Topic
  - Working title
  - Target topic/theme
  - Angle or unique perspective

  ## Audience & Purpose
  - Target audience description
  - Primary goal (inform, persuade, entertain, etc.)
  - Reader takeaway

  ## Content Strategy
  - Word count target
  - SEO keywords
  - Key points to cover

  When building a deliverable, create:
  - Engaging introduction
  - Clear section headings
  - Actionable content
  - Strong conclusion with CTA

  When conversing, provide helpful suggestions for improving blog content.

modes:
  plan:
    enabled: true
    actions:
      - create
      - read
      - list
      - edit
      - set_current
      - delete_version
      - merge_versions
      - copy_version
      - delete

  build:
    enabled: true
    actions:
      - create
      - read
      - list
      - edit
      - rerun
      - set_current
      - delete_version
      - merge_versions
      - copy_version
      - delete

  converse:
    enabled: true

llm_defaults:
  provider: ollama
  model: llama3.2:1b
  temperature: 0.7
'
) ON CONFLICT (organization_slug, slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  yaml = EXCLUDED.yaml,
  updated_at = now();

-- Add agent_card and context
UPDATE public.agents
SET
  agent_card = jsonb_build_object(
    'system_prompt', 'Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.

When creating a plan for a blog post, structure it with the following sections:

# Blog Post Plan

## Title & Topic
- Working title
- Target topic/theme
- Angle or unique perspective

## Audience & Purpose
- Target audience description
- Primary goal (inform, persuade, entertain, etc.)
- Reader takeaway

## Content Strategy
- Word count target
- SEO keywords
- Key points to cover

When building a deliverable, create:
- Engaging introduction
- Clear section headings
- Actionable content
- Strong conclusion with CTA

When conversing, provide helpful suggestions for improving blog content.'
  ),
  context = jsonb_build_object(
    'plan', jsonb_build_object(
      'template', 'Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.

When creating a plan for a blog post, structure it with the following sections:

# Blog Post Plan

## Title & Topic
- Working title
- Target topic/theme
- Angle or unique perspective

## Audience & Purpose
- Target audience description
- Primary goal (inform, persuade, entertain, etc.)
- Reader takeaway

## Content Strategy
- Word count target
- SEO keywords
- Key points to cover

When building a deliverable, create:
- Engaging introduction
- Clear section headings
- Actionable content
- Strong conclusion with CTA

When conversing, provide helpful suggestions for improving blog content.'
    ),
    'build', jsonb_build_object(
      'template', 'Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.

When creating a plan for a blog post, structure it with the following sections:

# Blog Post Plan

## Title & Topic
- Working title
- Target topic/theme
- Angle or unique perspective

## Audience & Purpose
- Target audience description
- Primary goal (inform, persuade, entertain, etc.)
- Reader takeaway

## Content Strategy
- Word count target
- SEO keywords
- Key points to cover

When building a deliverable, create:
- Engaging introduction
- Clear section headings
- Actionable content
- Strong conclusion with CTA

When conversing, provide helpful suggestions for improving blog content.'
    ),
    'converse', jsonb_build_object(
      'template', 'Creates SEO-friendly blog posts in Markdown format with clear structure and helpful tone. Supports full mode × action architecture with plans and deliverables.

When creating a plan for a blog post, structure it with the following sections:

# Blog Post Plan

## Title & Topic
- Working title
- Target topic/theme
- Angle or unique perspective

## Audience & Purpose
- Target audience description
- Primary goal (inform, persuade, entertain, etc.)
- Reader takeaway

## Content Strategy
- Word count target
- SEO keywords
- Key points to cover

When building a deliverable, create:
- Engaging introduction
- Clear section headings
- Actionable content
- Strong conclusion with CTA

When conversing, provide helpful suggestions for improving blog content.'
    )
  ),
  config = jsonb_build_object(
    'llm_defaults', jsonb_build_object(
      'provider', 'ollama',
      'model', 'llama3.2:1b',
      'temperature', 0.7
    )
  )
WHERE slug = 'blog_post_writer' AND organization_slug = 'my-org';

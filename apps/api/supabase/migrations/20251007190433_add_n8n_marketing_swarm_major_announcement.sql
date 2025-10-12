-- Migration: Add n8n workflow - Marketing Swarm - Major Announcement
-- Source: n8n export
-- Workflow ID: Q08T7oMX2dZslqV4
-- Created: 2025-10-08 00:04:33 UTC

-- Ensure schema & tables exist before inserting workflow data.
CREATE SCHEMA IF NOT EXISTS n8n;

CREATE TABLE IF NOT EXISTS n8n.n8n_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS n8n.migration_metadata (
  migration_file TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  workflow_id TEXT,
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO n8n.n8n_workflows (
  id,
  name,
  active,
  nodes,
  connections,
  settings,
  created_at,
  updated_at
)
VALUES (
  'Q08T7oMX2dZslqV4',
  'Marketing Swarm - Major Announcement',
  true,
  '[{"parameters":{"httpMethod":"POST","path":"marketing-swarm","options":{},"responseMode":"responseNode"},"id":"webhook","name":"Webhook Trigger","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[112,112],"webhookId":"7f338c6b-a9bb-446b-9a1d-702739d89a51"},{"parameters":{"assignments":{"assignments":[{"name":"status","type":"string","value":"started"},{"name":"taskId","type":"string","value":"={{ $json.taskId }}"},{"name":"executionId","type":"string","value":"={{ $execution.id }}"},{"name":"timestamp","type":"string","value":"={{ $now.toISO() }}"},{"name":"step","type":"string","value":"initialization"},{"name":"conversationId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.conversationId }}"},{"name":"userId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.userId }}"},{"name":"sequence","type":"number","value":1},{"name":"totalSteps","type":"number","value":5}]}},"id":"statusStart","name":"Status: Started","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[304,0]},{"parameters":{"method":"POST","url":"={{ $json.statusWebhook || ''http://host.docker.internal:7100/webhooks/status'' }}","sendBody":true,"specifyBody":"json","jsonBody":"={{ JSON.stringify($json) }}","options":{}},"id":"webhookStatusStart","name":"Send Status: Started","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[512,0]},{"parameters":{"prompt":"=Write a compelling web post announcement for: {{ $json.announcement }}. Include headline, introduction, key features, and call-to-action. Format as HTML.","options":{"maxTokens":1000,"temperature":0.7},"requestOptions":{}},"id":"webPost","name":"Generate Web Post","type":"n8n-nodes-base.openAi","typeVersion":1.1,"position":[304,208],"credentials":{"openAiApi":{"id":"B2oF5F10osX9S0yy","name":"OpenAi account"}}},{"parameters":{"assignments":{"assignments":[{"name":"status","type":"string","value":"in_progress"},{"name":"taskId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.taskId }}"},{"name":"executionId","type":"string","value":"={{ $execution.id }}"},{"name":"timestamp","type":"string","value":"={{ $now.toISO() }}"},{"name":"step","type":"string","value":"web_post_complete"},{"name":"webPost","type":"string","value":"={{ $json.text }}"},{"name":"conversationId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.conversationId }}"},{"name":"userId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.userId }}"},{"name":"sequence","type":"number","value":2},{"name":"totalSteps","type":"number","value":5}]}},"id":"statusWebPost","name":"Status: Web Post Done","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[512,208]},{"parameters":{"method":"POST","url":"={{ $json.statusWebhook || ''http://host.docker.internal:7100/webhooks/status'' }}","sendBody":true,"specifyBody":"json","jsonBody":"={{ JSON.stringify($json) }}","options":{}},"id":"webhookStatusWebPost","name":"Send Status: Web Post","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[704,100]},{"parameters":{"prompt":"=Create SEO-optimized content for: {{ $json.announcement }}. Include meta title, meta description, keywords, and structured data JSON-LD.","options":{"maxTokens":800,"temperature":0.5},"requestOptions":{}},"id":"seoContent","name":"Generate SEO Content","type":"n8n-nodes-base.openAi","typeVersion":1.1,"position":[704,300],"credentials":{"openAiApi":{"id":"B2oF5F10osX9S0yy","name":"OpenAi account"}}},{"parameters":{"assignments":{"assignments":[{"name":"status","type":"string","value":"in_progress"},{"name":"taskId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.taskId }}"},{"name":"executionId","type":"string","value":"={{ $execution.id }}"},{"name":"timestamp","type":"string","value":"={{ $now.toISO() }}"},{"name":"step","type":"string","value":"seo_complete"},{"name":"seoContent","type":"string","value":"={{ $json.text }}"},{"name":"conversationId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.conversationId }}"},{"name":"userId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.userId }}"},{"name":"sequence","type":"number","value":3},{"name":"totalSteps","type":"number","value":5}]}},"id":"statusSEO","name":"Status: SEO Done","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[912,300]},{"parameters":{"method":"POST","url":"={{ $json.statusWebhook || ''http://host.docker.internal:7100/webhooks/status'' }}","sendBody":true,"specifyBody":"json","jsonBody":"={{ JSON.stringify($json) }}","options":{}},"id":"webhookStatusSEO","name":"Send Status: SEO","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[1104,200]},{"parameters":{"prompt":"=Create social media posts for: {{ $json.announcement }}. Generate posts for Twitter/X (280 chars), LinkedIn (professional, 1300 chars), and Facebook (engaging, 500 chars). Include relevant hashtags.","options":{"maxTokens":1200,"temperature":0.8},"requestOptions":{}},"id":"socialMedia","name":"Generate Social Media","type":"n8n-nodes-base.openAi","typeVersion":1.1,"position":[1104,400],"credentials":{"openAiApi":{"id":"B2oF5F10osX9S0yy","name":"OpenAi account"}}},{"parameters":{"assignments":{"assignments":[{"name":"status","type":"string","value":"in_progress"},{"name":"taskId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.taskId }}"},{"name":"executionId","type":"string","value":"={{ $execution.id }}"},{"name":"timestamp","type":"string","value":"={{ $now.toISO() }}"},{"name":"step","type":"string","value":"social_media_complete"},{"name":"socialMedia","type":"string","value":"={{ $(''Generate Social Media'').item.json.text }}"},{"name":"conversationId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.conversationId }}"},{"name":"userId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.userId }}"},{"name":"sequence","type":"number","value":4},{"name":"totalSteps","type":"number","value":5}]}},"id":"statusSocial","name":"Status: Social Done","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1312,400]},{"parameters":{"method":"POST","url":"={{ $json.statusWebhook || ''http://host.docker.internal:7100/webhooks/status'' }}","sendBody":true,"specifyBody":"json","jsonBody":"={{ JSON.stringify($json) }}","options":{}},"id":"webhookStatusSocial","name":"Send Status: Social","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[1504,300]},{"parameters":{"assignments":{"assignments":[{"name":"status","type":"string","value":"completed"},{"name":"taskId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.taskId }}"},{"name":"conversationId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.conversationId }}"},{"name":"userId","type":"string","value":"={{ $(''Webhook Trigger'').item.json.body.userId }}"},{"name":"executionId","type":"string","value":"={{ $execution.id }}"},{"name":"timestamp","type":"string","value":"={{ $now.toISO() }}"},{"name":"webPost","type":"string","value":"={{ $(''Status: Web Post Done'').item.json.webPost }}"},{"name":"seoContent","type":"string","value":"={{ $(''Status: SEO Done'').item.json.seoContent }}"},{"name":"socialMedia","type":"string","value":"={{ $(''Status: Social Done'').item.json.socialMedia }}"},{"name":"sequence","type":"number","value":5},{"name":"totalSteps","type":"number","value":5}]}},"id":"finalOutput","name":"Final Output","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1504,500]},{"parameters":{"method":"POST","url":"={{ $json.statusWebhook || ''http://host.docker.internal:7100/webhooks/status'' }}","sendBody":true,"specifyBody":"json","jsonBody":"={{ JSON.stringify($json) }}","options":{}},"id":"webhookStatusComplete","name":"Send Status: Complete","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[1712,500]},{"parameters":{"mode":"manual","assignments":{"assignments":[{"name":"status","type":"string","value":"completed"},{"name":"taskId","type":"string","value":"={{ $(''Final Output'').item.json.taskId }}"},{"name":"conversationId","type":"string","value":"={{ $(''Final Output'').item.json.conversationId }}"},{"name":"userId","type":"string","value":"={{ $(''Final Output'').item.json.userId }}"},{"name":"executionId","type":"string","value":"={{ $(''Final Output'').item.json.executionId }}"},{"name":"timestamp","type":"string","value":"={{ $(''Final Output'').item.json.timestamp }}"},{"name":"webPost","type":"string","value":"={{ $(''Final Output'').item.json.webPost }}"},{"name":"seoContent","type":"string","value":"={{ $(''Final Output'').item.json.seoContent }}"},{"name":"socialMedia","type":"string","value":"={{ $(''Final Output'').item.json.socialMedia }}"}]}},"id":"finalResponse","name":"Final Response","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1912,500]},{"parameters":{"respondWith":"json","responseBody":"={{ $json }}"},"id":"respondWebhook","name":"Respond to Webhook","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.1,"position":[2112,500]}]'::jsonb,
  '{"Webhook Trigger":{"main":[[{"node":"Status: Started","type":"main","index":0},{"node":"Generate Web Post","type":"main","index":0}]]},"Status: Started":{"main":[[{"node":"Send Status: Started","type":"main","index":0}]]},"Generate Web Post":{"main":[[{"node":"Status: Web Post Done","type":"main","index":0}]]},"Status: Web Post Done":{"main":[[{"node":"Send Status: Web Post","type":"main","index":0},{"node":"Generate SEO Content","type":"main","index":0}]]},"Generate SEO Content":{"main":[[{"node":"Status: SEO Done","type":"main","index":0}]]},"Status: SEO Done":{"main":[[{"node":"Send Status: SEO","type":"main","index":0},{"node":"Generate Social Media","type":"main","index":0}]]},"Generate Social Media":{"main":[[{"node":"Status: Social Done","type":"main","index":0}]]},"Status: Social Done":{"main":[[{"node":"Send Status: Social","type":"main","index":0},{"node":"Final Output","type":"main","index":0}]]},"Final Output":{"main":[[{"node":"Send Status: Complete","type":"main","index":0}]]},"Send Status: Complete":{"main":[[{"node":"Final Response","type":"main","index":0}]]},"Final Response":{"main":[[{"node":"Respond to Webhook","type":"main","index":0}]]}}'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at
WHERE n8n.n8n_workflows.updated_at < EXCLUDED.updated_at;

-- Track migration metadata
INSERT INTO n8n.migration_metadata (migration_file, source, workflow_id, notes)
VALUES (
  '20251007190433_add_n8n_marketing_swarm_major_announcement.sql',
  'n8n-export',
  'Q08T7oMX2dZslqV4',
  'Exported from n8n API'
)
ON CONFLICT (migration_file) DO NOTHING;

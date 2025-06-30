-- Seed data for built-in CIDAFM commands
-- Based on the CID_AFM.md specification, this migration populates core AFM commands

-- Insert Execution Commands (!)
INSERT INTO public.cidafm_commands (type, name, description, default_active, is_builtin) VALUES
('!', 'import-cid', 'Read a CID and process its contents. If a [Context] section is present, add its contents to current chat memory. If an [AFMs] section is present, store the AFMs without activating them.', false, true),
('!', 'export-context', 'Summarize the current chat memory in preparation for transfer to a new chat. Returns a detailed, cold-start compatible summary under a [Context] tag.', false, true),
('!', 'state-check', 'Create a list of all currently active state modifier AFMs and their current toggle status (on or off).', false, true),
('!', 'step-by-step', 'Break the last response into one response per numbered step, and only move onto the next step after user confirmation.', false, true);

-- Insert Response Modifiers (^)
INSERT INTO public.cidafm_commands (type, name, description, default_active, is_builtin) VALUES
('^', 'cidafm-optimize', 'Take the requested text and create a new version that is token-efficient, clear of redundancies, and context-independent. Then assess the newly generated text for meaningfulness retention, token efficiency, lack of redundancy, and context-independence.', false, true),
('^', 'fad', 'Assume the contents of the prompt are a proposition, then provide the best argument for it, followed by the best argument against it. Then, provide your decision based on both arguments.', false, true),
('^', 'concise', 'Make only the current response concise and to the point, minimizing word count while preserving meaning.', false, true),
('^', 'detailed', 'Provide a comprehensive and detailed response with thorough explanations and examples.', false, true),
('^', 'creative', 'Apply creative thinking and novel approaches to the response, encouraging innovative solutions.', false, true);

-- Insert State Modifiers (&)
INSERT INTO public.cidafm_commands (type, name, description, default_active, is_builtin) VALUES
('&', 'token-efficient', 'Minimize the number of tokens used in responses while preserving clarity and relevance. Automatically prioritize brevity and reduce redundancy without losing meaning.', true, true),
('&', 'context-independent', 'Ensure responses are as context-independent as possible, providing all necessary information for complete understanding without relying on external context.', false, true),
('&', 'disciplined', 'Follow explicit user instructions without inference. Request clarification if instructions are unclear. Do not make assumptions about user intent.', false, true),
('&', 'friendly', 'Make all responses more warm and personable, using a conversational and approachable tone.', false, true),
('&', 'professional', 'Maintain a formal, business-appropriate tone in all responses. Use professional language and structure.', false, true),
('&', 'technical', 'Focus on technical accuracy and precision. Include relevant technical details and use appropriate terminology.', false, true),
('&', 'educational', 'Structure responses to be educational, explaining concepts step-by-step and providing learning context.', false, true);

-- Insert additional useful AFMs that extend the core specification
INSERT INTO public.cidafm_commands (type, name, description, default_active, is_builtin) VALUES
-- Additional execution commands
('!', 'cost-estimate', 'Calculate and display the estimated cost for the current conversation or proposed query.', false, true),
('!', 'model-info', 'Display information about the currently selected LLM model including capabilities, pricing, and optimal use cases.', false, true),
('!', 'usage-stats', 'Show current usage statistics including tokens consumed, costs, and performance metrics.', false, true),

-- Additional response modifiers
('^', 'code-focused', 'Prioritize code examples and technical implementation details in the response.', false, true),
('^', 'beginner-friendly', 'Explain concepts assuming no prior knowledge, using simple language and basic examples.', false, true),
('^', 'bullet-points', 'Structure the response using bullet points and lists for easy scanning.', false, true),
('^', 'with-examples', 'Include practical examples and use cases to illustrate all concepts discussed.', false, true),

-- Additional state modifiers
('&', 'cost-conscious', 'Always consider and minimize token usage and costs. Provide cost warnings for expensive operations.', false, true),
('&', 'security-focused', 'Prioritize security considerations and best practices in all responses.', false, true),
('&', 'multilingual', 'Be prepared to respond in multiple languages and consider international perspectives.', false, true),
('&', 'accessible', 'Ensure responses are accessible to users with different abilities and technical backgrounds.', false, true);

-- Add helpful metadata about CIDAFM command types
COMMENT ON COLUMN public.cidafm_commands.type IS 'CIDAFM command type: ^ (response modifier), & (state modifier), ! (execution command)';
COMMENT ON COLUMN public.cidafm_commands.name IS 'Command name used in prompts (without the type prefix)';
COMMENT ON COLUMN public.cidafm_commands.description IS 'Detailed description of what the command does';
COMMENT ON COLUMN public.cidafm_commands.default_active IS 'Whether this command is active by default (mainly for & state modifiers)';
COMMENT ON COLUMN public.cidafm_commands.is_builtin IS 'Whether this is a built-in command or user-created custom command';

-- Create a view for easy querying of commands by type
CREATE VIEW public.cidafm_commands_by_type AS
SELECT 
    type,
    type || name as full_command,
    name,
    description,
    default_active,
    is_builtin,
    CASE 
        WHEN type = '^' THEN 'Response Modifier'
        WHEN type = '&' THEN 'State Modifier' 
        WHEN type = '!' THEN 'Execution Command'
    END as type_description,
    created_at
FROM public.cidafm_commands
WHERE is_builtin = true
ORDER BY type, name;

COMMENT ON VIEW public.cidafm_commands_by_type IS 'View of CIDAFM commands organized by type with helpful descriptions';

-- Grant read access to the view
GRANT SELECT ON public.cidafm_commands_by_type TO authenticated;
GRANT SELECT ON public.cidafm_commands_by_type TO service_role;
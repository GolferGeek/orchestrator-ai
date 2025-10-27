#!/usr/bin/env node
/**
 * Multi-Agent Observability Hook Script
 * Sends Claude Code hook events to the observability server.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

// Load environment variables from root .env
const rootEnvPath = path.join(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  [key: string]: any;
}

interface EventData {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: any;
  timestamp: number;
  chat?: any[];
  summary?: string;
  model_name?: string;
}

async function sendEventToServer(eventData: EventData, serverUrl: string = 'http://localhost:4100/events'): Promise<boolean> {
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Claude-Code-Hook/1.0'
      },
      body: JSON.stringify(eventData)
    });

    if (response.ok) {
      return true;
    } else {
      console.error(`Server returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to send event: ${error}`);
    return false;
  }
}

async function readChatTranscript(transcriptPath: string): Promise<any[] | null> {
  if (!fs.existsSync(transcriptPath)) {
    return null;
  }

  const chatData: any[] = [];

  try {
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        try {
          chatData.push(JSON.parse(trimmedLine));
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    return chatData;
  } catch (error) {
    console.error(`Failed to read transcript: ${error}`);
    return null;
  }
}

async function generateAISummary(eventType: string, payload: any): Promise<string> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.OBSERVABILITY_MODEL || 'claude-3-5-haiku-20241022';

  if (!anthropicApiKey) {
    return `${eventType} event`;
  }

  try {
    // Create a concise prompt focusing on the event type and key payload info
    const prompt = `Summarize this ${eventType} event in 10 words or less. Focus on the action taken.\n\nEvent: ${JSON.stringify(payload).slice(0, 500)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.content[0].text.trim();
    }
  } catch (error) {
    // Silently fall back to simple summary
  }

  return `${eventType} event`;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

function filterPayload(inputData: HookInput, eventType: string): any {
  // Clone the input data to avoid modifying the original
  const filtered: any = { ...inputData };

  // For PreToolUse and PostToolUse, strip out large content from tool responses
  if (eventType === 'PreToolUse' || eventType === 'PostToolUse') {
    // Keep tool name and input summary
    if (filtered.tool_input) {
      const toolInput: any = { ...filtered.tool_input };

      // Strip large content fields but keep metadata
      if (toolInput.content && typeof toolInput.content === 'string' && toolInput.content.length > 1000) {
        toolInput.content = `[Content truncated - ${toolInput.content.length} chars]`;
      }

      filtered.tool_input = toolInput;
    }

    // Strip large tool responses
    if (filtered.tool_response) {
      const toolResponse: any = { ...filtered.tool_response };

      if (toolResponse.file?.content && toolResponse.file.content.length > 1000) {
        toolResponse.file = {
          ...toolResponse.file,
          content: `[File content truncated - ${toolResponse.file.content.length} chars]`
        };
      }

      if (toolResponse.stdout && toolResponse.stdout.length > 1000) {
        toolResponse.stdout = `[Output truncated - ${toolResponse.stdout.length} chars]`;
      }

      filtered.tool_response = toolResponse;
    }
  }

  return filtered;
}

function detectAgentName(inputData: HookInput): string | null {
  // Try to detect agent name from various metadata fields
  if (inputData.agent_name) return inputData.agent_name;
  if (inputData.subagent_type) return inputData.subagent_type;

  // Check if this is a subagent by looking at the working directory or other context
  const cwd = process.env.CLAUDE_WORKING_DIR || process.cwd();

  // Look for agent indicator in working directory (e.g., /agent-name/ or /worktree-agent-name/)
  const agentMatch = cwd.match(/\/agent[-_]([^\/]+)/) || cwd.match(/\/worktree[-_]([^\/]+)/);
  if (agentMatch) return agentMatch[1];

  return null;
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let sourceApp = args.find((arg, i) => args[i - 1] === '--source-app');
  const eventType = args.find((arg, i) => args[i - 1] === '--event-type');
  const serverUrl = args.find((arg, i) => args[i - 1] === '--server-url') || 'http://localhost:4100/events';
  const addChat = args.includes('--add-chat');
  const summarize = args.includes('--summarize');
  const autoDetect = args.includes('--auto-detect');

  if (!eventType) {
    console.error('Usage: send-event.ts [--source-app <name>] --event-type <type> [--auto-detect] [--server-url <url>] [--add-chat] [--summarize]');
    process.exit(1);
  }

  try {
    // Read hook data from stdin
    const inputText = await readStdin();
    const inputData: HookInput = JSON.parse(inputText);

    // Auto-detect agent name if --auto-detect is set or if no source-app provided
    if (autoDetect || !sourceApp) {
      const detectedAgent = detectAgentName(inputData);
      if (detectedAgent) {
        sourceApp = detectedAgent;
      } else if (!sourceApp) {
        // Fallback to default if still not found
        sourceApp = 'orchestrator-ai';
      }
    }

    // Filter payload to remove large content (except for Stop events)
    const filteredPayload = eventType === 'Stop' ? inputData : filterPayload(inputData, eventType);

    // Prepare event data for server
    const eventData: EventData = {
      source_app: sourceApp,
      session_id: inputData.session_id || 'unknown',
      hook_event_type: eventType,
      payload: filteredPayload,
      timestamp: Date.now()
    };

    // Handle --add-chat option
    if (addChat && inputData.transcript_path) {
      const chatData = await readChatTranscript(inputData.transcript_path);
      if (chatData) {
        eventData.chat = chatData;
      }
    }

    // Generate AI summary if --summarize flag is set
    if (summarize) {
      eventData.summary = await generateAISummary(eventType, inputData);
    }

    // Send to server
    await sendEventToServer(eventData, serverUrl);

    // Always exit with 0 to not block Claude Code operations
    process.exit(0);
  } catch (error) {
    console.error(`Failed to process hook: ${error}`);
    process.exit(0); // Still exit 0 to not block
  }
}

main();

#!/usr/bin/env node
/**
 * Claude Code Status Line Script
 * Displays agent name, model, and current prompt in the status bar
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Configuration
const MAX_PROMPT_LENGTH = 50;
const SHOW_GIT_INFO = false;

interface HookInput {
  session_id?: string;
  model?: {
    display_name?: string;
  };
  [key: string]: any;
}

interface SessionData {
  agent_name?: string;
  prompts?: string[];
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  input_data: HookInput;
  status_line_output: string;
  error?: string;
}

function logStatusLine(
  inputData: HookInput,
  statusLineOutput: string,
  errorMessage?: string
): void {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'status_line.json');
    let logData: LogEntry[] = [];

    if (fs.existsSync(logFile)) {
      try {
        const content = fs.readFileSync(logFile, 'utf-8');
        logData = JSON.parse(content);
      } catch {
        logData = [];
      }
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      input_data: inputData,
      status_line_output: statusLineOutput,
    };

    if (errorMessage) {
      logEntry.error = errorMessage;
    }

    logData.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  } catch {
    // Silently fail logging to not block status line rendering
  }
}

function getGitBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return branch;
  } catch {
    return null;
  }
}

function getGitStatus(): string {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (status) {
      const lines = status.split('\n');
      return `±${lines.length}`;
    }
  } catch {
    // Ignore errors
  }
  return '';
}

function getSessionData(sessionId: string): [SessionData | null, string | null] {
  const sessionFile = path.join(
    process.cwd(),
    '.claude',
    'data',
    'sessions',
    `${sessionId}.json`
  );

  if (!fs.existsSync(sessionFile)) {
    return [null, `Session file ${sessionFile} does not exist`];
  }

  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    const sessionData = JSON.parse(content);
    return [sessionData, null];
  } catch (error) {
    return [null, `Error reading session file: ${error}`];
  }
}

function truncatePrompt(prompt: string, maxLength: number = MAX_PROMPT_LENGTH): string {
  // Remove newlines and excessive whitespace
  const cleaned = prompt.replace(/\s+/g, ' ').trim();

  if (cleaned.length > maxLength) {
    return cleaned.substring(0, maxLength - 3) + '...';
  }
  return cleaned;
}

function getPromptIcon(prompt: string): string {
  if (prompt.startsWith('/')) {
    return '⚡';
  } else if (prompt.includes('?')) {
    return '❓';
  } else if (
    ['create', 'write', 'add', 'implement', 'build'].some((word) =>
      prompt.toLowerCase().includes(word)
    )
  ) {
    return '💡';
  } else if (
    ['fix', 'debug', 'error', 'issue'].some((word) => prompt.toLowerCase().includes(word))
  ) {
    return '🐛';
  } else if (
    ['refactor', 'improve', 'optimize'].some((word) =>
      prompt.toLowerCase().includes(word)
    )
  ) {
    return '♻️';
  } else {
    return '💬';
  }
}

function generateStatusLine(inputData: HookInput): string {
  const sessionId = inputData.session_id || 'unknown';
  const modelName = inputData.model?.display_name || 'Claude';

  const [sessionData, error] = getSessionData(sessionId);

  if (error || !sessionData) {
    const statusLine = `\x1b[36m[${modelName}]\x1b[0m \x1b[90m💭 No session data\x1b[0m`;
    logStatusLine(inputData, statusLine, error || undefined);
    return statusLine;
  }

  const agentName = sessionData.agent_name || 'Agent';
  const prompts = sessionData.prompts || [];

  const parts: string[] = [];

  // Agent name - Red
  parts.push(`\x1b[91m[${agentName}]\x1b[0m`);

  // Model name - Blue
  parts.push(`\x1b[34m[${modelName}]\x1b[0m`);

  // Git branch and status - green (optional)
  if (SHOW_GIT_INFO) {
    const gitBranch = getGitBranch();
    if (gitBranch) {
      const gitStatus = getGitStatus();
      let gitInfo = `🌿 ${gitBranch}`;
      if (gitStatus) {
        gitInfo += ` ${gitStatus}`;
      }
      parts.push(`\x1b[32m${gitInfo}\x1b[0m`);
    }
  }

  // Most recent prompt only
  if (prompts.length > 0) {
    const currentPrompt = prompts[prompts.length - 1];
    const icon = getPromptIcon(currentPrompt);
    const truncated = truncatePrompt(currentPrompt, MAX_PROMPT_LENGTH);
    parts.push(`${icon} \x1b[97m${truncated}\x1b[0m`);
  } else {
    parts.push('\x1b[90m💭 No prompts yet\x1b[0m');
  }

  return parts.join(' | ');
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

async function main() {
  try {
    const inputText = await readStdin();
    const inputData: HookInput = JSON.parse(inputText);

    const statusLine = generateStatusLine(inputData);
    logStatusLine(inputData, statusLine);

    console.log(statusLine);
    process.exit(0);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.log('\x1b[31m[Agent] [Claude] 💭 JSON Error\x1b[0m');
    } else {
      console.log(`\x1b[31m[Agent] [Claude] 💭 Error: ${error}\x1b[0m`);
    }
    process.exit(0);
  }
}

main();

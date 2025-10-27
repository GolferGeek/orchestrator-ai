#!/usr/bin/env node
/**
 * Apply observability hooks template to agent configurations
 * Usage: npx tsx .claude/scripts/apply-observability-hooks.ts [agent-name]
 *
 * If agent-name is provided, only that agent is updated.
 * Otherwise, all agents in .claude/agents/ are updated.
 */

import * as fs from 'fs';
import * as path from 'path';

const AGENTS_DIR = path.join(__dirname, '../agents');
const TEMPLATE_PATH = path.join(__dirname, '../hooks-templates/observability.json');

interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string;
  model?: string;
  color?: string;
  observability_enabled?: boolean;
  [key: string]: any;
}

function parseAgentFile(content: string): { frontmatter: AgentFrontmatter; body: string } | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const frontmatterText = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Parse YAML-like frontmatter
  const frontmatter: AgentFrontmatter = {};
  frontmatterText.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // Handle boolean values
      if (value === 'true') frontmatter[key] = true;
      else if (value === 'false') frontmatter[key] = false;
      else frontmatter[key] = value;
    }
  });

  return { frontmatter, body };
}

function applyHooksToAgent(agentPath: string, templatePath: string): boolean {
  try {
    const content = fs.readFileSync(agentPath, 'utf-8');
    const parsed = parseAgentFile(content);

    if (!parsed) {
      console.error(`Failed to parse agent file: ${agentPath}`);
      return false;
    }

    const { frontmatter, body } = parsed;

    // Skip if observability is explicitly disabled
    if (frontmatter.observability_enabled === false) {
      console.log(`⏭️  Skipping ${frontmatter.name} (observability disabled)`);
      return false;
    }

    // Read hooks template
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    let hooksTemplate = JSON.parse(templateContent);

    // Replace {{SOURCE_APP}} with agent name
    const sourceApp = frontmatter.name || path.basename(agentPath, '.md');
    const hooksString = JSON.stringify(hooksTemplate, null, 2)
      .replace(/\{\{SOURCE_APP\}\}/g, sourceApp);
    hooksTemplate = JSON.parse(hooksString);

    // Add hooks to frontmatter
    frontmatter.hooks = hooksTemplate;

    // Rebuild frontmatter
    const newFrontmatter = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (key === 'hooks') {
          // Special handling for hooks - output as JSON
          return `hooks: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    const newContent = `---\n${newFrontmatter}\n---\n${body}`;

    // Write back to file
    fs.writeFileSync(agentPath, newContent, 'utf-8');
    console.log(`✅ Updated ${sourceApp}`);
    return true;
  } catch (error) {
    console.error(`Error processing ${agentPath}:`, error);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const targetAgent = args[0];

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  if (targetAgent) {
    // Apply to specific agent
    const agentPath = path.join(AGENTS_DIR, `${targetAgent}.md`);
    if (!fs.existsSync(agentPath)) {
      console.error(`Agent not found: ${agentPath}`);
      process.exit(1);
    }
    applyHooksToAgent(agentPath, TEMPLATE_PATH);
  } else {
    // Apply to all agents
    const agentFiles = fs.readdirSync(AGENTS_DIR)
      .filter(f => f.endsWith('.md'));

    console.log(`Applying observability hooks to ${agentFiles.length} agents...\n`);

    let successCount = 0;
    agentFiles.forEach(file => {
      const agentPath = path.join(AGENTS_DIR, file);
      if (applyHooksToAgent(agentPath, TEMPLATE_PATH)) {
        successCount++;
      }
    });

    console.log(`\n✨ Updated ${successCount}/${agentFiles.length} agents`);
  }
}

main();

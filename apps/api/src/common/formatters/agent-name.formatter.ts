import { Injectable } from '@nestjs/common';

/**
 * Agent Name Formatter - Dynamic agent display name generation
 * 
 * Converts technical agent names to user-friendly display names with appropriate emojis.
 * Uses pattern matching and word analysis instead of hard-coded mappings.
 */
@Injectable()
export class AgentNameFormatter {
  
  /**
   * Format agent name for user display
   */
  formatDisplayName(agentName: string): string {
    if (!agentName) return 'Unknown Agent';
    
    // Clean the agent name
    const cleanName = agentName.toLowerCase().trim();
    
    // Check for orchestrator/manager patterns
    if (this.isOrchestrator(cleanName)) {
      return this.formatOrchestratorName(cleanName);
    }
    
    // Format specialist agent names
    return this.formatSpecialistName(cleanName);
  }
  
  /**
   * Check if agent is an orchestrator/manager
   */
  private isOrchestrator(agentName: string): boolean {
    return agentName.includes('orchestrator') || 
           agentName.includes('manager') ||
           agentName.includes('_manager_');
  }
  
  /**
   * Format orchestrator names
   */
  private formatOrchestratorName(agentName: string): string {
    // Extract department and role
    const parts = agentName.split('_');
    
    // CEO orchestrator special case
    if (agentName.includes('ceo')) {
      return '👔 CEO Orchestrator';
    }
    
    // Department manager pattern: {department}_manager_orchestrator
    const departmentEmojis: Record<string, string> = {
      'marketing': '🎯',
      'engineering': '⚙️',
      'operations': '🔧',
      'finance': '💼',
      'hr': '👥',
      'sales': '💼',
      'product': '📦',
      'research': '🔬',
      'legal': '⚖️',
      'productivity': '⚡',
      'specialists': '🎯'
    };
    
    // Find department name
    const department = parts.find(part => departmentEmojis[part]);
    if (department) {
      const emoji = departmentEmojis[department];
      const displayName = this.capitalizeWords(department);
      return `${emoji} ${displayName} Manager`;
    }
    
    // Generic orchestrator fallback
    const baseName = parts[0] || 'unknown';
    const displayName = this.capitalizeWords(baseName);
    return `🎭 ${displayName} Orchestrator`;
  }
  
  /**
   * Format specialist agent names
   */
  private formatSpecialistName(agentName: string): string {
    // Emoji mappings for common agent types
    const typeEmojis: Record<string, string> = {
      'content': '📝',
      'blog': '📰',
      'market': '📊',
      'research': '📊',
      'competitor': '🏢',
      'competitive': '🏢',
      'social': '📱',
      'email': '📧',
      'seo': '🔍',
      'analytics': '📈',
      'branding': '🎨',
      'brand': '🎨',
      'copywriting': '✍️',
      'copy': '✍️',
      'pr': '📢',
      'public': '📢',
      'relations': '📢',
      'campaign': '📋',
      'conversion': '💰',
      'optimization': '💰',
      'swarm': '🎯'
    };
    
    // Find matching emoji
    let emoji = '🤖'; // Default robot emoji
    for (const [key, emojiIcon] of Object.entries(typeEmojis)) {
      if (agentName.includes(key)) {
        emoji = emojiIcon;
        break;
      }
    }
    
    // Create display name
    const displayName = this.formatAgentTitle(agentName);
    return `${emoji} ${displayName}`;
  }
  
  /**
   * Format agent title from technical name
   */
  private formatAgentTitle(agentName: string): string {
    return agentName
      .split('_')
      .map(word => this.capitalizeWord(word))
      .join(' ') + ' Agent';
  }
  
  /**
   * Capitalize multiple words
   */
  private capitalizeWords(text: string): string {
    return text
      .split('_')
      .map(word => this.capitalizeWord(word))
      .join(' ');
  }
  
  /**
   * Capitalize a single word
   */
  private capitalizeWord(word: string): string {
    if (!word) return '';
    
    // Handle special cases
    const specialCases: Record<string, string> = {
      'seo': 'SEO',
      'pr': 'PR',
      'hr': 'HR',
      'ceo': 'CEO',
      'cto': 'CTO',
      'cmo': 'CMO',
      'cfo': 'CFO'
    };
    
    const lowerWord = word.toLowerCase();
    if (specialCases[lowerWord]) {
      return specialCases[lowerWord];
    }
    
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  
  /**
   * Get short display name (without emoji, for compact display)
   */
  formatShortName(agentName: string): string {
    const fullName = this.formatDisplayName(agentName);
    // Remove emoji and return just the name part
    return fullName.replace(/^[^\s]+\s/, '');
  }
  
  /**
   * Get just the emoji for an agent
   */
  getAgentEmoji(agentName: string): string {
    const fullName = this.formatDisplayName(agentName);
    const emojiMatch = fullName.match(/^([^\s]+)/);
    return emojiMatch?.[1] || '🤖';
  }
}
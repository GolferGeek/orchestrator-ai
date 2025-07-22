import type { AgentChatMessage, DeliverableOptions } from './types';

/**
 * Service for managing deliverable creation and duplicate prevention
 */
export class DeliverableService {
  
  /**
   * Append deliverable to message with comprehensive duplicate prevention
   */
  appendDeliverable(
    message: AgentChatMessage, 
    options: DeliverableOptions
  ): { updated: boolean; reason: string } {
    const { taskId, content, existingContent } = options;
    
    // Multi-layer duplicate prevention
    const duplicateCheck = this.checkForDuplicates(message, existingContent);
    
    if (duplicateCheck.isDuplicate) {
      console.log(`⚠️ Deliverable already exists for task ${taskId}, skipping duplicate: ${duplicateCheck.reason}`);
      
      // Just update metadata to ensure it's marked as completed
      message.metadata = {
        ...message.metadata,
        isPlaceholder: false,
        isCompleted: true,
        processingCompletion: false
      };
      
      return { updated: false, reason: duplicateCheck.reason };
    }
    
    // Append the deliverable
    const cleanedContent = this.cleanExistingContent(existingContent);
    message.content = cleanedContent + `\n\n---\n\n**📋 Requirements Document:**\n\n${content}`;
    
    message.metadata = {
      ...message.metadata,
      isPlaceholder: false,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      processingCompletion: false
    };
    
    console.log(`✅ Deliverable added to task ${taskId} for the first time`);
    return { updated: true, reason: 'deliverable_added' };
  }

  /**
   * Comprehensive duplicate detection
   */
  private checkForDuplicates(
    message: AgentChatMessage, 
    existingContent: string
  ): { isDuplicate: boolean; reason: string } {
    
    // Check 1: Content-based detection
    if (existingContent.includes('**📋 Requirements Document:**')) {
      return { isDuplicate: true, reason: 'content_contains_deliverable_marker' };
    }
    
    // Check 2: Metadata-based detection
    if (message.metadata?.isCompleted) {
      return { isDuplicate: true, reason: 'message_already_completed' };
    }
    
    // Check 3: Processing lock detection
    if (message.metadata?.processingCompletion) {
      return { isDuplicate: true, reason: 'completion_already_in_progress' };
    }
    
    // Check 4: Content length heuristic (deliverables are usually long)
    if (existingContent.length > 2000 && existingContent.includes('---')) {
      return { isDuplicate: true, reason: 'content_appears_to_have_deliverable' };
    }
    
    return { isDuplicate: false, reason: 'no_duplicates_detected' };
  }

  /**
   * Clean existing content by removing processing indicators
   */
  private cleanExistingContent(content: string): string {
    return content
      .replace(/🔄 Processing final response\.\.\./g, '')
      .trim();
  }

  /**
   * Set processing lock to prevent concurrent completions
   */
  setProcessingLock(message: AgentChatMessage, taskId: string): boolean {
    if (message.metadata?.processingCompletion) {
      console.log(`⚠️ Task ${taskId} completion already in progress, ignoring duplicate call`);
      return false;
    }
    
    if (message.metadata?.isCompleted) {
      console.log(`⚠️ Task ${taskId} completion already processed, ignoring duplicate call`);
      return false;
    }
    
    // Set processing lock
    message.metadata = { 
      ...message.metadata, 
      processingCompletion: true 
    };
    
    return true;
  }

  /**
   * Clear processing lock
   */
  clearProcessingLock(message: AgentChatMessage): void {
    if (message.metadata) {
      message.metadata.processingCompletion = false;
    }
  }

  /**
   * Format deliverable content with standard structure
   */
  formatDeliverable(content: string, type: string = 'Requirements Document'): string {
    return `\n\n---\n\n**📋 ${type}:**\n\n${content}`;
  }

  /**
   * Check if message already has a deliverable
   */
  hasDeliverable(message: AgentChatMessage): boolean {
    return message.content.includes('**📋') || 
           message.content.includes('Requirements Document') ||
           (message.metadata?.isCompleted ?? false);
  }

  /**
   * Extract deliverable section from message content
   */
  extractDeliverableSection(content: string): string | null {
    const match = content.match(/\*\*📋.*?:\*\*\n\n([\s\S]*)/);
    return match ? match[1].trim() : null;
  }

  /**
   * Count deliverable sections in content (for debugging)
   */
  countDeliverables(content: string): number {
    const matches = content.match(/\*\*📋.*?:\*\*/g);
    return matches ? matches.length : 0;
  }
}

// Export singleton instance
export const deliverable = new DeliverableService();
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
    const newContent = cleanedContent + `\n\n---\n\n**📋 Requirements Document:**\n\n${content}`;
    message.content = newContent;
    message.metadata = {
      ...message.metadata,
      isPlaceholder: false,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      processingCompletion: false
    };
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
    // Check 3: Processing lock detection - but only if deliverable isn't already there
    if (message.metadata?.processingCompletion) {
      // If processing is in progress but no deliverable content exists, allow retry
      if (!existingContent.includes('📋 Requirements Document:') && !existingContent.includes('---')) {
        return { isDuplicate: false, reason: 'processing_but_no_content' };
      }
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
      return false;
    }
    if (message.metadata?.isCompleted) {
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
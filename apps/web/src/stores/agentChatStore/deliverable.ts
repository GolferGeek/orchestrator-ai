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
    
    console.log(`📋 DEBUG: appendDeliverable called for task ${taskId}`);
    console.log(`📋 DEBUG: Content length: ${content?.length || 0}`);
    console.log(`📋 DEBUG: Existing content length: ${existingContent?.length || 0}`);
    console.log(`📋 DEBUG: Message metadata:`, message.metadata);
    
    // Multi-layer duplicate prevention
    const duplicateCheck = this.checkForDuplicates(message, existingContent);
    console.log(`📋 DEBUG: Duplicate check result:`, duplicateCheck);
    
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
    
    console.log(`📋 DEBUG: Proceeding with deliverable append for task ${taskId}`);
    
    // Append the deliverable
    const cleanedContent = this.cleanExistingContent(existingContent);
    console.log(`📋 DEBUG: Cleaned content:`, cleanedContent);
    console.log(`📋 DEBUG: About to set new content with deliverable`);
    
    const newContent = cleanedContent + `\n\n---\n\n**📋 Requirements Document:**\n\n${content}`;
    console.log(`📋 DEBUG: New content length: ${newContent.length}`);
    
    message.content = newContent;
    
    message.metadata = {
      ...message.metadata,
      isPlaceholder: false,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      processingCompletion: false
    };
    
    console.log(`✅ Deliverable added to task ${taskId} for the first time`);
    console.log(`📋 DEBUG: Final message content length: ${message.content.length}`);
    return { updated: true, reason: 'deliverable_added' };
  }

  /**
   * Comprehensive duplicate detection
   */
  private checkForDuplicates(
    message: AgentChatMessage, 
    existingContent: string
  ): { isDuplicate: boolean; reason: string } {
    
    console.log(`📋 DEBUG: Checking for duplicates...`);
    console.log(`📋 DEBUG: Existing content includes deliverable marker: ${existingContent.includes('**📋 Requirements Document:**')}`);
    console.log(`📋 DEBUG: Message isCompleted: ${message.metadata?.isCompleted}`);
    console.log(`📋 DEBUG: Message processingCompletion: ${message.metadata?.processingCompletion}`);
    
    // Check 1: Content-based detection
    if (existingContent.includes('**📋 Requirements Document:**')) {
      console.log(`📋 DEBUG: Duplicate detected - content contains deliverable marker`);
      return { isDuplicate: true, reason: 'content_contains_deliverable_marker' };
    }
    
    // Check 2: Metadata-based detection
    if (message.metadata?.isCompleted) {
      console.log(`📋 DEBUG: Duplicate detected - message already completed`);
      return { isDuplicate: true, reason: 'message_already_completed' };
    }
    
    // Check 3: Processing lock detection - but only if deliverable isn't already there
    if (message.metadata?.processingCompletion) {
      console.log(`📋 DEBUG: Processing lock detected, checking for existing deliverable content`);
      // If processing is in progress but no deliverable content exists, allow retry
      if (!existingContent.includes('📋 Requirements Document:') && !existingContent.includes('---')) {
        console.log(`🔄 Processing lock detected but no deliverable content found, allowing retry`);
        return { isDuplicate: false, reason: 'processing_but_no_content' };
      }
      console.log(`📋 DEBUG: Duplicate detected - completion already in progress with content`);
      return { isDuplicate: true, reason: 'completion_already_in_progress' };
    }
    
    // Check 4: Content length heuristic (deliverables are usually long)
    if (existingContent.length > 2000 && existingContent.includes('---')) {
      console.log(`📋 DEBUG: Duplicate detected - content appears to have deliverable`);
      return { isDuplicate: true, reason: 'content_appears_to_have_deliverable' };
    }
    
    console.log(`📋 DEBUG: No duplicates detected`);
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
import type { AgentChatMessage } from './types';

/**
 * Service for formatting and processing agent response messages
 */
export class MessageFormattingService {
  
  /**
   * Create a response message from a completed task
   */
  createResponseMessage(conversationId: string, task: any): AgentChatMessage | null {
    
    let responseContent = 'Task completed successfully.';
    let responseMetadata: Record<string, any> = {};
    
    // Check both task.response (database field) and task.result (immediate mode field)
    const responseData = task.response || task.result;
    
    // Also check for deliverable ID directly on the task
    if (task.deliverableId) {
      responseMetadata.deliverableId = task.deliverableId;
    }
    
    if (responseData) {
      try {
        // Try to parse JSON if it's a string
        let parsedResult;
        if (typeof responseData === 'string') {
          try {
            parsedResult = JSON.parse(responseData);
          } catch {
            // Not JSON, use as plain text
            responseContent = responseData;
            parsedResult = null;
          }
        } else {
          parsedResult = responseData;
        }
        
        // Extract content from various possible formats
        if (parsedResult) {
          if (parsedResult.success && parsedResult.message) {
            // Format: { success: true, message: "content", metadata: {...} } (orchestrator format)
            responseContent = String(parsedResult.message);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (parsedResult.success && parsedResult.response) {
            // Format: { success: true, response: "content", metadata: {...}, deliverableId: "uuid" }
            responseContent = String(parsedResult.response);
            responseMetadata = parsedResult.metadata || {};

            // Extract deliverable ID if present - THIS IS THE KEY FIX
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (parsedResult.success) {
            // Format: { success: true, response: "content", deliverableId: "..." } (current blog post format)
            responseContent = String(parsedResult.response || parsedResult.message || 'Success');
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (parsedResult.message) {
            // Format: { message: "content" }
            responseContent = String(parsedResult.message);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (parsedResult.response) {
            // Format: { response: "content" }
            responseContent = String(parsedResult.response);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (parsedResult.content) {
            // Format: { content: "content" }
            responseContent = String(parsedResult.content);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (parsedResult.result) {
            // Format: { result: "content" }
            responseContent = String(parsedResult.result);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          } else if (typeof parsedResult === 'string') {
            // Format: "content"
            responseContent = parsedResult;
          } else {
            // Fallback: stringify the whole object
            responseContent = JSON.stringify(parsedResult, null, 2);
            // Still check for deliverable ID even in fallback case
            if (parsedResult.deliverableId) {
              responseMetadata.deliverableId = parsedResult.deliverableId;
            }
          }
        }
        
        
        // Check if this is a completed workflow response with embedded progress steps
        if (responseContent.includes('**📋 Requirements Document:**')) {
          const docSectionMatch = responseContent.match(/\*\*📋 Requirements Document:\*\*\n\n([\s\S]*)/);
          if (docSectionMatch && docSectionMatch[1]) {
            responseContent = docSectionMatch[1].trim();
          }
        }

      } catch {
        // If parsing fails, use the raw response
        responseContent = String(responseData);
        
        // Also check raw content for embedded document
        if (responseContent.includes('**📋 Requirements Document:**')) {
          const docSectionMatch = responseContent.match(/\*\*📋 Requirements Document:\*\*\n\n([\s\S]*)/);
          if (docSectionMatch && docSectionMatch[1]) {
            responseContent = docSectionMatch[1].trim();
          }
        }
        
        // Also check if raw content has JSON data with the document
        if (responseContent.includes('"response":') && (responseContent.includes('# Technical Requirements Document') || responseContent.includes('# '))) {
          try {
            // Try to extract the response field from JSON string
            const jsonMatch = responseContent.match(/"response":\s*"([^"]+)"/);
            if (jsonMatch && jsonMatch[1]) {
              responseContent = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
          } catch {
            // Keep original content
          }
        }
      }
    }

    return {
      id: `response-${Date.now()}`,
      role: 'assistant' as const,
      content: responseContent,
      timestamp: new Date(),
      taskId: task.taskId,
      metadata: {
        isPlaceholder: false,
        isCompleted: true,
        completedAt: new Date().toISOString(),
        ...responseMetadata,
      },
    };
  }

  /**
   * Create a user message
   */
  createUserMessage(content: string): AgentChatMessage {
    return {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: {}
    };
  }

  /**
   * Create a placeholder message for ongoing tasks
   */
  createPlaceholderMessage(taskId: string, mode?: string): AgentChatMessage {
    // Friendlier, mode-aware placeholder bubble text
    let content = 'Processing your request...';
    // Ensure mode is a string before calling toLowerCase
    const m = typeof mode === 'string' ? mode.toLowerCase() : '';
    if (m === 'converse') {
      content = 'One sec — thinking it through…';
    } else if (m === 'plan') {
      content = 'Sketching a quick plan…';
    }

    return {
      id: `placeholder-${Date.now()}`,
      role: 'assistant' as const,
      content,
      timestamp: new Date(),
      taskId,
      metadata: {
        isPlaceholder: true,
        isCompleted: false,
        completedSteps: [],
        mode: m || undefined,
      },
    };
  }

  /**
   * Extract and format deliverable content from task response
   */
  extractDeliverableContent(task: any): string {
    
    let finalContent = '';
    
    // Check both task.response (database field) and task.result (immediate mode field)
    const responseData = task.response || task.result;
    
    if (responseData) {
      try {
        // Try to parse JSON if it's a string
        let parsedResult;
        if (typeof responseData === 'string') {
          try {
            parsedResult = JSON.parse(responseData);
          } catch {
            // Not JSON, use as plain text
            finalContent = responseData;
            parsedResult = null;
          }
        } else {
          parsedResult = responseData;
        }
        
        // Extract content from various possible formats
        if (parsedResult) {
          if (parsedResult.success && parsedResult.message) {
            // Format: { success: true, message: "content", metadata: {...} } (orchestrator format)
            finalContent = String(parsedResult.message);
          } else if (parsedResult.success && parsedResult.response) {
            // Format: { success: true, response: "content", metadata: {...} }
            finalContent = String(parsedResult.response);
          } else if (parsedResult.message) {
            // Format: { message: "content" }
            finalContent = String(parsedResult.message);
          } else if (parsedResult.response) {
            // Format: { response: "content" }
            finalContent = String(parsedResult.response);
          } else if (parsedResult.content) {
            // Format: { content: "content" }
            finalContent = String(parsedResult.content);
          } else if (parsedResult.result) {
            // Format: { result: "content" }
            finalContent = String(parsedResult.result);
          } else if (typeof parsedResult === 'string') {
            // Format: "content"
            finalContent = parsedResult;
          } else {
            // Fallback: stringify the whole object
            finalContent = JSON.stringify(parsedResult, null, 2);
          }
        }
      } catch (error) {
        console.error('🔄 Error parsing completion response:', error);
        finalContent = String(responseData);
      }
    }
    
    if (!finalContent || finalContent.trim() === '') {
      finalContent = 'No content was generated. Please check the logs for more details.';
    }

    return finalContent;
  }

  /**
   * Format progress messages for display
   */
  formatProgressContent(messages: any[]): string {
    const progressMessages = messages.filter(msg => msg.messageType === 'progress');
    let progressContent = 'Processing your request...\n\n';
    
    progressMessages.forEach(msg => {
      // Parse message content to extract step information
      try {
        const messageData = JSON.parse(msg.content);
        if (messageData.stepName && messageData.message) {
          const stepEmoji = messageData.status === 'completed' ? '✅' : '🔄';
          progressContent += `${stepEmoji} ${messageData.message}\n`;
        }
      } catch {
        // If not JSON, treat as plain text
        progressContent += `🔄 ${msg.content}\n`;
      }
    });
    
    return progressContent.trim();
  }
}

// Export singleton instance
export const messageFormatting = new MessageFormattingService();

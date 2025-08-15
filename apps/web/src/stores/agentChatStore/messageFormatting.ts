import type { AgentChatMessage } from './types';

/**
 * Service for formatting and processing agent response messages
 */
export class MessageFormattingService {
  
  /**
   * Create a response message from a completed task
   */
  createResponseMessage(conversationId: string, task: any): AgentChatMessage | null {
    console.log(`📝 Creating response message for task ${task.taskId}:`, {
      hasResponse: !!task.response,
      responseType: typeof task.response,
      responseLength: task.response?.length || 0,
      responsePreview: typeof task.response === 'string' ? task.response.substring(0, 200) : task.response ? JSON.stringify(task.response).substring(0, 200) : 'undefined'
    });
    
    // Debug: Log the entire task structure to see what fields are available
    console.log(`🔍 DEBUG - Full task object structure for ${task.taskId}:`, {
      taskKeys: Object.keys(task),
      taskId: task.taskId,
      status: task.status,
      hasResponse: 'response' in task,
      responseValue: task.response,
      taskSample: JSON.stringify(task).substring(0, 500) + '...'
    });
    
    let responseContent = 'Task completed successfully.';
    let responseMetadata: Record<string, any> = {};
    
    // Check both task.response (database field) and task.result (immediate mode field)
    const responseData = task.response || task.result;
    
    // Also check for deliverable ID directly on the task
    if (task.deliverableId) {
      responseMetadata.deliverable_id = task.deliverableId;
    }
    
    if (responseData) {
      try {
        // Try to parse JSON if it's a string
        let parsedResult;
        if (typeof responseData === 'string') {
          try {
            parsedResult = JSON.parse(responseData);
            console.log('📄 Parsed JSON response structure:', {
              type: typeof parsedResult,
              hasSuccess: 'success' in parsedResult,
              hasResponse: 'response' in parsedResult,
              keys: Object.keys(parsedResult)
            });
          } catch {
            // Not JSON, use as plain text
            console.log('📄 Response is plain text, using directly');
            responseContent = responseData;
            parsedResult = null;
          }
        } else {
          parsedResult = responseData;
          console.log('📄 Response is object:', Object.keys(parsedResult));
        }
        
        // Extract content from various possible formats
        if (parsedResult) {
          if (parsedResult.success && parsedResult.message) {
            // Format: { success: true, message: "content", metadata: {...} } (orchestrator format)
            responseContent = String(parsedResult.message);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using success.message format (orchestrator)');
          } else if (parsedResult.success && parsedResult.response) {
            // Format: { success: true, response: "content", metadata: {...}, deliverableId: "uuid" }
            responseContent = String(parsedResult.response);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present - THIS IS THE KEY FIX
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
              console.log('🎭 ✅ EXTRACTED deliverable ID in success.response format:', parsedResult.deliverableId);
            } else {
              console.log('🎭 ❌ NO deliverable ID found in parsedResult keys:', Object.keys(parsedResult));
            }
            console.log('📄 Using success.response format');
          } else if (parsedResult.success) {
            // Format: { success: true, response: "content", deliverableId: "..." } (current blog post format)
            responseContent = String(parsedResult.response || parsedResult.message || 'Success');
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using success format with deliverableId');
          } else if (parsedResult.message) {
            // Format: { message: "content" }
            responseContent = String(parsedResult.message);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using message field');
          } else if (parsedResult.response) {
            // Format: { response: "content" }
            responseContent = String(parsedResult.response);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using response field');
          } else if (parsedResult.content) {
            // Format: { content: "content" }
            responseContent = String(parsedResult.content);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using content field');
          } else if (parsedResult.result) {
            // Format: { result: "content" }
            responseContent = String(parsedResult.result);
            responseMetadata = parsedResult.metadata || {};
            // Extract deliverable ID if present
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using result field');
          } else if (typeof parsedResult === 'string') {
            // Format: "content"
            responseContent = parsedResult;
            console.log('📄 Using direct string');
          } else {
            // Fallback: stringify the whole object
            responseContent = JSON.stringify(parsedResult, null, 2);
            // Still check for deliverable ID even in fallback case
            if (parsedResult.deliverableId) {
              responseMetadata.deliverable_id = parsedResult.deliverableId;
            }
            console.log('📄 Using stringified object as fallback');
          }
        }
        
        console.log('📄 Parsed response content:', responseContent.substring(0, 200) + '...');
        
        // Check if this is a completed workflow response with embedded progress steps
        if (responseContent.includes('**📋 Requirements Document:**')) {
          const docSectionMatch = responseContent.match(/\*\*📋 Requirements Document:\*\*\n\n([\s\S]*)/);
          if (docSectionMatch && docSectionMatch[1]) {
            responseContent = docSectionMatch[1].trim();
            console.log('📋 Extracted requirements document content:', responseContent.substring(0, 200) + '...');
          }
        }
      } catch {
        // If parsing fails, use the raw response
        responseContent = String(responseData);
        console.log('📄 Raw response content:', responseContent.substring(0, 200) + '...');
        
        // Also check raw content for embedded document
        if (responseContent.includes('**📋 Requirements Document:**')) {
          const docSectionMatch = responseContent.match(/\*\*📋 Requirements Document:\*\*\n\n([\s\S]*)/);
          if (docSectionMatch && docSectionMatch[1]) {
            responseContent = docSectionMatch[1].trim();
            console.log('📋 Extracted requirements document from raw content:', responseContent.substring(0, 200) + '...');
          }
        }
        
        // Also check if raw content has JSON data with the document
        if (responseContent.includes('"response":') && (responseContent.includes('# Technical Requirements Document') || responseContent.includes('# '))) {
          try {
            // Try to extract the response field from JSON string
            const jsonMatch = responseContent.match(/"response":\s*"([^"]+)"/);
            if (jsonMatch && jsonMatch[1]) {
              responseContent = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              console.log('📋 Extracted document from JSON string:', responseContent.substring(0, 200) + '...');
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
   * Create a placeholder message for ongoing tasks
   */
  createPlaceholderMessage(taskId: string): AgentChatMessage {
    return {
      id: `placeholder-${Date.now()}`,
      role: 'assistant' as const,
      content: 'Processing your request...',
      timestamp: new Date(),
      taskId,
      metadata: {
        isPlaceholder: true,
        isCompleted: false,
        completedSteps: [],
      },
    };
  }

  /**
   * Extract and format deliverable content from task response
   */
  extractDeliverableContent(task: any): string {
    console.log(`🔄 Parsing completion response for task ${task.taskId}:`, {
      hasResponse: !!task.response,
      responseType: typeof task.response,
      responseLength: task.response?.length || 0,
      responsePreview: typeof task.response === 'string' ? task.response.substring(0, 200) : task.response ? JSON.stringify(task.response).substring(0, 200) : 'undefined'
    });
    
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
            console.log('🔄 Parsed JSON completion response structure:', {
              type: typeof parsedResult,
              hasSuccess: 'success' in parsedResult,
              hasResponse: 'response' in parsedResult,
              keys: Object.keys(parsedResult)
            });
          } catch {
            // Not JSON, use as plain text
            console.log('🔄 Completion response is plain text, using directly');
            finalContent = responseData;
            parsedResult = null;
          }
        } else {
          parsedResult = responseData;
          console.log('🔄 Completion response is object:', Object.keys(parsedResult));
        }
        
        // Extract content from various possible formats
        if (parsedResult) {
          if (parsedResult.success && parsedResult.message) {
            // Format: { success: true, message: "content", metadata: {...} } (orchestrator format)
            finalContent = String(parsedResult.message);
            console.log('🔄 Using success.message format for completion (orchestrator)');
          } else if (parsedResult.success && parsedResult.response) {
            // Format: { success: true, response: "content", metadata: {...} }
            finalContent = String(parsedResult.response);
            console.log('🔄 Using success.response format for completion');
          } else if (parsedResult.message) {
            // Format: { message: "content" }
            finalContent = String(parsedResult.message);
            console.log('🔄 Using message field for completion');
          } else if (parsedResult.response) {
            // Format: { response: "content" }
            finalContent = String(parsedResult.response);
            console.log('🔄 Using response field for completion');
          } else if (parsedResult.content) {
            // Format: { content: "content" }
            finalContent = String(parsedResult.content);
            console.log('🔄 Using content field for completion');
          } else if (parsedResult.result) {
            // Format: { result: "content" }
            finalContent = String(parsedResult.result);
            console.log('🔄 Using result field for completion');
          } else if (typeof parsedResult === 'string') {
            // Format: "content"
            finalContent = parsedResult;
            console.log('🔄 Using direct string for completion');
          } else {
            // Fallback: stringify the whole object
            finalContent = JSON.stringify(parsedResult, null, 2);
            console.log('🔄 Using stringified object as fallback for completion');
          }
        }
      } catch (error) {
        console.error('🔄 Error parsing completion response:', error);
        finalContent = String(responseData);
      }
    }
    
    if (!finalContent || finalContent.trim() === '') {
      console.warn('🔄 No final content extracted from completion response');
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
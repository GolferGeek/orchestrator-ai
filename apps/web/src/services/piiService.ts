console.log('🔍 [DEBUG] PIIService: Starting imports');
import { apiService } from './apiService';
console.log('🔍 [DEBUG] PIIService: apiService imported');
import {
  PIIPattern,
  PIITestRequest,
  PIITestResponse,
  PIIStatsResponse,
  PIIPatternBulkOperation,
  PIIPatternBulkResult
} from '@/types/pii';
console.log('🔍 [DEBUG] PIIService: PII types imported');
import { useApiSanitization } from '@/composables/useApiSanitization';
console.log('🔍 [DEBUG] PIIService: useApiSanitization imported');

class PIIService {
  // Align with backend routes under /llm/sanitization
  private readonly basePath = '/llm/sanitization';
  private _apiSanitization: unknown = null;
  
  private get apiSanitization() {
    console.log('🔍 [DEBUG] PIIService: Accessing apiSanitization getter');
    if (!this._apiSanitization) {
      console.log('🔍 [DEBUG] PIIService: Creating useApiSanitization instance');
      this._apiSanitization = useApiSanitization();
      console.log('🔍 [DEBUG] PIIService: useApiSanitization instance created');
    }
    return this._apiSanitization;
  }

  // =====================================
  // PII PATTERN ENDPOINTS
  // =====================================

  /**
   * Get all PII patterns
   */
  async getPIIPatterns(): Promise<PIIPattern[]> {
    try {
      const response = await apiService.getQuiet404(`${this.basePath}/pii/patterns`);
      return response.patterns || [];
    } catch (error) {
      // Graceful demo fallback without noisy logs for 404
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return [];
      }
      console.error('Error fetching PII patterns:', error);
      throw error;
    }
  }

  /**
   * Get a specific PII pattern by ID
   */
  async getPIIPattern(id: string): Promise<PIIPattern> {
    try {
      const response = await apiService.get(`${this.basePath}/pii/patterns/${id}`);
      return response.pattern;
    } catch (error) {
      console.error(`Error fetching PII pattern ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new PII pattern
   */
  async createPIIPattern(pattern: Omit<PIIPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<PIIPattern> {
    try {
      const response = await apiService.post(`${this.basePath}/pii/patterns`, pattern);
      return response.pattern;
    } catch (error) {
      console.error('Error creating PII pattern:', error);
      throw error;
    }
  }

  /**
   * Update an existing PII pattern
   */
  async updatePIIPattern(id: string, pattern: Partial<PIIPattern>): Promise<PIIPattern> {
    try {
      const response = await apiService.put(`${this.basePath}/pii/patterns/${id}`, pattern);
      return response.pattern;
    } catch (error) {
      console.error(`Error updating PII pattern ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a PII pattern
   */
  async deletePIIPattern(id: string): Promise<void> {
    try {
      await apiService.delete(`${this.basePath}/pii/patterns/${id}`);
    } catch (error) {
      console.error(`Error deleting PII pattern ${id}:`, error);
      throw error;
    }
  }

  /**
   * Bulk operations on PII patterns (enable, disable, delete)
   */
  async bulkOperationPIIPatterns(operation: PIIPatternBulkOperation): Promise<PIIPatternBulkResult> {
    try {
      const response = await apiService.post(`${this.basePath}/pii/patterns/bulk`, operation);
      return response;
    } catch (error) {
      console.error('Error performing bulk operation on PII patterns:', error);
      throw error;
    }
  }

  // =====================================
  // PII TESTING ENDPOINTS
  // =====================================

  /**
   * Test PII detection on text
   */
  async testPIIDetection(request: PIITestRequest): Promise<PIITestResponse> {
    try {
      // Sanitize the PII test request
      const sanitizedRequest = this.apiSanitization.sanitizePIIRequest(request);
      const response = await apiService.post(`${this.basePath}/pii/test`, sanitizedRequest);
      return response;
    } catch (error) {
      console.error('Error testing PII detection:', error);
      throw error;
    }
  }

  /**
   * Sanitize text (full sanitization with redaction and pseudonymization)
   */
  async sanitizeText(request: PIITestRequest): Promise<PIITestResponse> {
    try {
      // Sanitize the request before sending
      const sanitizedRequest = this.apiSanitization.sanitizePIIRequest(request);
      const response = await apiService.post(`${this.basePath}/sanitize`, sanitizedRequest);
      return response;
    } catch (error) {
      console.error('Error sanitizing text:', error);
      throw error;
    }
  }

  // =====================================
  // STATS AND ANALYTICS ENDPOINTS
  // =====================================

  /**
   * Get PII management statistics
   */
  async getPIIStats(): Promise<PIIStatsResponse> {
    try {
      const response = await apiService.getQuiet404(`${this.basePath}/stats`);
      return response;
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return {
          totalPatterns: 0,
          customPatterns: 0,
          enabledPatterns: 0,
          detectionsByType: {},
          lastUpdated: new Date().toISOString()
        } as unknown;
      }
      console.error('Error fetching PII stats:', error);
      throw error;
    }
  }

  // =====================================
  // VALIDATION HELPERS
  // =====================================

  /**
   * Validate a regex pattern
   */
  validateRegexPattern(pattern: string): { isValid: boolean; error?: string } {
    try {
      new RegExp(pattern);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid regex pattern'
      };
    }
  }

  /**
   * Test a regex pattern against sample text
   */
  testRegexPattern(pattern: string, sampleText: string): { matches: string[]; error?: string } {
    try {
      const regex = new RegExp(pattern, 'g');
      const matches = sampleText.match(regex) || [];
      return { matches };
    } catch (error) {
      return {
        matches: [],
        error: error instanceof Error ? error.message : 'Invalid regex pattern'
      };
    }
  }
}

// Export singleton instance
export const piiService = new PIIService();
export default piiService;

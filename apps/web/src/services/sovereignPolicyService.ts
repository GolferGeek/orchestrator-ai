import axios, { AxiosResponse } from 'axios';
import { getSecureApiBaseUrl, getSecureHeaders } from '../utils/securityConfig';
import type { Model } from '@/types/llm';

// API endpoint configuration
const API_BASE_URL = getSecureApiBaseUrl();

export interface SovereignPolicy {
  enforced: boolean;
  defaultMode: 'strict' | 'relaxed';
  auditLevel: 'none' | 'basic' | 'full';
  realtimeUpdates: boolean;
  validation: {
    valid: boolean;
    warnings: string[];
  };
}

export interface SovereignPolicyStatus {
  enforced: boolean;
  defaultMode: string;
  allowedProviders: string[];
}

export interface PolicyValidationRequest {
  enforced?: boolean;
  defaultMode?: 'strict' | 'relaxed';
  userSovereignMode?: boolean;
  auditLevel?: 'none' | 'basic' | 'full';
}

export interface PolicyValidationResponse {
  valid: boolean;
  effectiveSovereignMode: boolean;
  warnings: string[];
  errors: string[];
  precedenceExplanation?: string;
}

class SovereignPolicyService {
  private axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: getSecureHeaders(),
    timeout: 10000,
  });

  /**
   * Fetch the current sovereign mode policy
   */
  async getPolicy(): Promise<SovereignPolicy> {
    try {
      const response: AxiosResponse<SovereignPolicy> = await this.axiosInstance.get(
        '/api/sovereign-policy'
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch sovereign policy:', error);
      throw new Error('Failed to fetch sovereign policy');
    }
  }

  /**
   * Fetch simplified sovereign mode status
   */
  async getPolicyStatus(): Promise<SovereignPolicyStatus> {
    try {
      const response: AxiosResponse<SovereignPolicyStatus> = await this.axiosInstance.get(
        '/api/sovereign-policy/status'
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch sovereign policy status:', error);
      throw new Error('Failed to fetch sovereign policy status');
    }
  }

  /**
   * Validate policy configuration
   */
  async validatePolicy(request: PolicyValidationRequest): Promise<PolicyValidationResponse> {
    try {
      const response: AxiosResponse<PolicyValidationResponse> = await this.axiosInstance.post(
        '/api/sovereign-policy/validate',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Failed to validate policy:', error);
      throw new Error('Failed to validate policy');
    }
  }

  /**
   * Fetch models with sovereign mode filtering
   */
  async getModels(sovereignMode?: boolean): Promise<Model[]> {
    try {
      const params = sovereignMode ? { sovereign_mode: true, include_provider: true } : { include_provider: true };
      const response: AxiosResponse<Model[]> = await this.axiosInstance.get('/models', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      throw new Error('Failed to fetch models');
    }
  }
}

export const sovereignPolicyService = new SovereignPolicyService();

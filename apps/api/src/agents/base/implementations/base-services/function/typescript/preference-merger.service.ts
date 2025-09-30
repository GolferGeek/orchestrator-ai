import { Injectable } from '@nestjs/common';

export interface UserPreferences {
  providerName?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  cidafmOptions?: any;
  authToken?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface LLMOptions {
  providerName?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  cidafmOptions?: any;
  authToken?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface AgentParams {
  userMessage?: string;
  sessionId?: string;
  conversationHistory?: any[];
  currentUser?: any;
  authToken?: string;
  providerName?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  cidafmOptions?: any;
  [key: string]: any;
}

/**
 * Service for merging user preferences with agent function options
 * Handles preference inheritance, validation, and default value management
 */
@Injectable()
export class PreferenceMergerService {
  /**
   * Merge user preferences with base options, giving priority to user preferences
   */
  mergeLLMOptions(
    baseOptions: LLMOptions = {},
    userPreferences: UserPreferences = {},
  ): LLMOptions {
    const merged: LLMOptions = { ...baseOptions };

    // User preferences take priority over base options
    const preferenceKeys: (keyof UserPreferences)[] = [
      'providerName',
      'modelName',
      'temperature',
      'maxTokens',
      'cidafmOptions',
      'authToken',
      'sessionId',
    ];

    preferenceKeys.forEach((key) => {
      if (userPreferences[key] !== undefined && userPreferences[key] !== null) {
        merged[key] = userPreferences[key];
      }
    });

    return merged;
  }

  /**
   * Extract user preferences from agent parameters
   */
  extractUserPreferences(params: AgentParams): UserPreferences {
    return {
      providerName: params.providerName,
      modelName: params.modelName,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      cidafmOptions: params.cidafmOptions,
      authToken: params.authToken,
      sessionId: params.sessionId,
    };
  }

  /**
   * Create merged options for LLM service calls
   */
  createMergedOptions(
    baseOptions: LLMOptions,
    params: AgentParams,
  ): LLMOptions {
    const userPreferences = this.extractUserPreferences(params);
    return this.mergeLLMOptions(baseOptions, userPreferences);
  }

  /**
   * Validate LLM options and apply defaults
   */
  validateAndApplyDefaults(
    options: LLMOptions,
    defaults?: Partial<LLMOptions>,
  ): { valid: boolean; options: LLMOptions; errors: string[] } {
    const errors: string[] = [];
    const validatedOptions: LLMOptions = { ...options };

    // Apply defaults if not provided
    if (defaults) {
      Object.keys(defaults).forEach((key) => {
        if (
          validatedOptions[key] === undefined ||
          validatedOptions[key] === null
        ) {
          validatedOptions[key] = defaults[key];
        }
      });
    }

    // Validate temperature
    if (validatedOptions.temperature !== undefined) {
      if (typeof validatedOptions.temperature !== 'number') {
        errors.push('Temperature must be a number');
      } else if (
        validatedOptions.temperature < 0 ||
        validatedOptions.temperature > 2
      ) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    // Validate maxTokens
    if (validatedOptions.maxTokens !== undefined) {
      if (typeof validatedOptions.maxTokens !== 'number') {
        errors.push('MaxTokens must be a number');
      } else if (
        validatedOptions.maxTokens < 1 ||
        validatedOptions.maxTokens > 100000
      ) {
        errors.push('MaxTokens must be between 1 and 100,000');
      }
    }

    // Validate providerName
    if (validatedOptions.providerName !== undefined) {
      if (
        typeof validatedOptions.providerName !== 'string' ||
        validatedOptions.providerName.trim().length === 0
      ) {
        errors.push('ProviderName must be a non-empty string');
      }
    }

    // Validate modelName
    if (validatedOptions.modelName !== undefined) {
      if (
        typeof validatedOptions.modelName !== 'string' ||
        validatedOptions.modelName.trim().length === 0
      ) {
        errors.push('ModelName must be a non-empty string');
      }
    }

    return {
      valid: errors.length === 0,
      options: validatedOptions,
      errors,
    };
  }

  /**
   * Create a preference inheritance chain
   */
  createInheritanceChain(
    ...optionSources: (LLMOptions | undefined)[]
  ): LLMOptions {
    const result: LLMOptions = {};

    // Apply options in order, with later sources taking priority
    optionSources.forEach((source) => {
      if (source) {
        Object.keys(source).forEach((key) => {
          if (source[key] !== undefined && source[key] !== null) {
            result[key] = source[key];
          }
        });
      }
    });

    return result;
  }

  /**
   * Get preference precedence order for documentation/debugging
   */
  getPreferencePrecedence(): {
    order: string[];
    description: Record<string, string>;
  } {
    return {
      order: [
        'system_defaults',
        'agent_defaults',
        'user_session_preferences',
        'request_parameters',
      ],
      description: {
        system_defaults: 'Global system default values',
        agent_defaults: 'Agent-specific default configurations',
        user_session_preferences: "User's saved preferences for the session",
        request_parameters:
          'Parameters provided with the specific request (highest priority)',
      },
    };
  }

  /**
   * Generate preference summary for debugging
   */
  generatePreferenceSummary(
    finalOptions: LLMOptions,
    sources: {
      systemDefaults?: LLMOptions;
      agentDefaults?: LLMOptions;
      userPreferences?: UserPreferences;
      requestParams?: AgentParams;
    },
  ): {
    finalOptions: LLMOptions;
    sourceMap: Record<string, string>;
    conflicts: Array<{
      key: string;
      values: Array<{ source: string; value: any }>;
      resolved: any;
    }>;
  } {
    const sourceMap: Record<string, string> = {};
    const conflicts: Array<{
      key: string;
      values: Array<{ source: string; value: any }>;
      resolved: any;
    }> = [];

    const allSources = [
      { name: 'systemDefaults', options: sources.systemDefaults },
      { name: 'agentDefaults', options: sources.agentDefaults },
      { name: 'userPreferences', options: sources.userPreferences },
      {
        name: 'requestParams',
        options: this.extractUserPreferences(sources.requestParams || {}),
      },
    ];

    // Track where each final value came from
    Object.keys(finalOptions).forEach((key) => {
      const sourcesWithValue = allSources
        .filter(
          (source) =>
            source.options &&
            source.options[key] !== undefined &&
            source.options[key] !== null,
        )
        .map((source) => ({
          source: source.name,
          value: source.options![key],
        }));

      if (sourcesWithValue.length > 0) {
        const lastSource = sourcesWithValue[sourcesWithValue.length - 1];
        if (lastSource) {
          sourceMap[key] = lastSource.source; // Last source wins
        }

        // Record conflicts if multiple sources had different values
        if (sourcesWithValue.length > 1) {
          const uniqueValues = new Set(
            sourcesWithValue.map((s) => JSON.stringify(s.value)),
          );
          if (uniqueValues.size > 1) {
            conflicts.push({
              key,
              values: sourcesWithValue,
              resolved: finalOptions[key],
            });
          }
        }
      }
    });

    return {
      finalOptions,
      sourceMap,
      conflicts,
    };
  }

  /**
   * Create a preferences validator function
   */
  createValidator(
    requiredFields?: (keyof LLMOptions)[],
    customValidators?: Record<string, (value: any) => string | null>,
  ) {
    return (options: LLMOptions): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      // Check required fields
      if (requiredFields) {
        requiredFields.forEach((field) => {
          if (options[field] === undefined || options[field] === null) {
            errors.push(`${field} is required`);
          }
        });
      }

      // Run custom validators
      if (customValidators) {
        Object.keys(customValidators).forEach((field) => {
          if (options[field] !== undefined && options[field] !== null) {
            const validator = customValidators[field];
            if (validator) {
              const _error = validator(options[field]);
              if (error) {
                errors.push(error);
              }
            }
          }
        });
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    };
  }

  /**
   * Sanitize options by removing null/undefined values
   */
  sanitizeOptions(options: LLMOptions): LLMOptions {
    const sanitized: LLMOptions = {};

    Object.keys(options).forEach((key) => {
      if (options[key] !== undefined && options[key] !== null) {
        sanitized[key] = options[key];
      }
    });

    return sanitized;
  }
}

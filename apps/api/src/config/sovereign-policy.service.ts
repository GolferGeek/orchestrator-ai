import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SovereignPolicy {
  enforced: boolean;
  defaultMode: 'strict' | 'relaxed';
  allowedProviders: string[];
  auditLevel: 'none' | 'basic' | 'full';
  realtimeUpdates: boolean;
}

@Injectable()
export class SovereignPolicyService {
  private readonly logger = new Logger(SovereignPolicyService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get the current sovereign mode policy from environment variables
   */
  getPolicy(): SovereignPolicy {
    const enforced = this.configService.get('SOVEREIGN_MODE_ENFORCED', 'false') === 'true';
    const defaultMode = this.configService.get('SOVEREIGN_MODE_DEFAULT', 'relaxed') as 'strict' | 'relaxed';
    const allowedProvidersStr = this.configService.get('SOVEREIGN_MODE_ALLOWED_PROVIDERS', 'ollama,local');
    const allowedProviders = allowedProvidersStr.split(',').map((p: string) => p.trim()).filter(Boolean);
    const auditLevel = this.configService.get('SOVEREIGN_MODE_AUDIT_LEVEL', 'basic') as 'none' | 'basic' | 'full';
    const realtimeUpdates = this.configService.get('SOVEREIGN_MODE_REALTIME_UPDATES', 'true') === 'true';

    return {
      enforced,
      defaultMode,
      allowedProviders,
      auditLevel,
      realtimeUpdates,
    };
  }

  /**
   * Check if sovereign mode is enforced organization-wide
   */
  isEnforced(): boolean {
    return this.getPolicy().enforced;
  }

  /**
   * Get the default sovereign mode for new users
   */
  getDefaultMode(): 'strict' | 'relaxed' {
    return this.getPolicy().defaultMode;
  }

  /**
   * Get allowed LLM providers in sovereign mode
   */
  getAllowedProviders(): string[] {
    return this.getPolicy().allowedProviders;
  }

  /**
   * Get audit logging level
   */
  getAuditLevel(): 'none' | 'basic' | 'full' {
    return this.getPolicy().auditLevel;
  }

  /**
   * Check if a provider is allowed in sovereign mode
   */
  isProviderAllowed(provider: string): boolean {
    return this.getAllowedProviders().includes(provider.toLowerCase());
  }

  /**
   * Validate current policy configuration and return warnings
   */
  validatePolicy(): { valid: boolean; warnings: string[] } {
    const policy = this.getPolicy();
    const warnings: string[] = [];

    // If enforced is true, default should probably be strict
    if (policy.enforced && policy.defaultMode === 'relaxed') {
      warnings.push(
        'Sovereign mode is enforced but default mode is relaxed. Consider setting SOVEREIGN_MODE_DEFAULT=strict for consistency.'
      );
    }

    // If default is strict, allowed providers should only include local ones
    if (policy.defaultMode === 'strict') {
      const hasExternalProviders = policy.allowedProviders.some(
        provider => !['ollama', 'local'].includes(provider.toLowerCase())
      );
      if (hasExternalProviders) {
        warnings.push(
          'Default mode is strict but allowed providers include external ones. This may confuse users.'
        );
      }
    }

    // If audit level is 'none' but enforced is true, suggest basic logging
    if (policy.enforced && policy.auditLevel === 'none') {
      warnings.push(
        'Sovereign mode is enforced but audit level is none. Consider enabling basic audit logging for compliance.'
      );
    }

    // Validate allowed providers format
    if (policy.allowedProviders.length === 0) {
      warnings.push('No allowed providers specified. At least one provider should be configured.');
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }
}

import { Controller, Get, Logger } from '@nestjs/common';
import { SovereignPolicyService, SovereignPolicy } from './sovereign-policy.service';

@Controller('api/sovereign-policy')
export class SovereignPolicyController {
  private readonly logger = new Logger(SovereignPolicyController.name);

  constructor(private readonly sovereignPolicyService: SovereignPolicyService) {}

  /**
   * Get the current sovereign mode policy
   * GET /api/sovereign-policy
   */
  @Get()
  getPolicy(): SovereignPolicy & { validation: { valid: boolean; warnings: string[] } } {
    this.logger.debug('Fetching sovereign mode policy');
    
    const policy = this.sovereignPolicyService.getPolicy();
    const validation = this.sovereignPolicyService.validatePolicy();
    
    return {
      ...policy,
      validation,
    };
  }

  /**
   * Get sovereign mode status (simplified endpoint)
   * GET /api/sovereign-policy/status
   */
  @Get('status')
  getStatus(): { enforced: boolean; defaultMode: string; allowedProviders: string[] } {
    const policy = this.sovereignPolicyService.getPolicy();
    
    return {
      enforced: policy.enforced,
      defaultMode: policy.defaultMode,
      allowedProviders: policy.enforced ? ['ollama'] : ['ollama', 'openai', 'anthropic'],
    };
  }
}

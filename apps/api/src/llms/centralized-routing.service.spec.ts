import { CentralizedRoutingService } from './centralized-routing.service';
import { LocalModelStatusService } from './local-model-status.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { SovereignPolicyService } from './config/sovereign-policy.service';
import { FeatureFlagService } from '../config/feature-flag.service';
import { PIIService } from './pii/pii.service';
import { DictionaryPseudonymizerService } from './pii/dictionary-pseudonymizer.service';
import { RunMetadataService } from './run-metadata.service';

function makeService(
  overrides?: Partial<{
    showstopper: boolean;
    localAvailable: boolean;
    bestLocalModel: string;
  }>,
) {
  const localStatus = {
    getLoadedModels: jest.fn(),
  } as unknown as LocalModelStatusService;
  const supabase = {} as SupabaseService;
  const sovereign = {
    getPolicy: jest.fn(() => ({
      enforced: false,
      defaultMode: 'relaxed',
      auditLevel: 'none',
    })),
    isProviderAllowed: jest.fn(() => true),
  } as unknown as SovereignPolicyService;
  const flags = {
    isSovereignRoutingEnabled: jest.fn(() => false),
  } as unknown as FeatureFlagService;
  const pii = {
    checkPolicy: jest.fn(() =>
      Promise.resolve({
        metadata: {
          piiDetected: overrides?.showstopper ?? false,
          showstopperDetected: overrides?.showstopper ?? false,
          detectionResults: {
            totalMatches: overrides?.showstopper ? 1 : 0,
            flaggedMatches: [],
            dataTypesSummary: {},
          },
          policyDecision: {
            allowed: !overrides?.showstopper,
            blocked: !!overrides?.showstopper,
            violations: [],
            reasoningPath: [],
          },
          processingFlow: overrides?.showstopper
            ? 'showstopper-blocked'
            : 'allowed-external',
          userMessage: {
            summary: '',
            details: [],
            actionsTaken: [],
            isBlocked: !!overrides?.showstopper,
          },
          processingSteps: [],
          timestamps: {},
        },
        originalPrompt: 'p',
      }),
    ),
  } as unknown as PIIService;
  const dict = {} as DictionaryPseudonymizerService;
  const usage = {
    insertCompletedUsage: jest.fn(() => Promise.resolve()),
  } as unknown as RunMetadataService;

  const service = new CentralizedRoutingService(
    localStatus,
    supabase,
    sovereign,
    flags,
    pii,
    dict,
    usage,
  );
  // Patch private methods for local availability and selection
  (
    service as unknown as {
      checkLocalModelAvailability: jest.Mock;
      selectBestLocalModel: jest.Mock;
    }
  ).checkLocalModelAvailability = jest.fn(() =>
    Promise.resolve(overrides?.localAvailable ?? false),
  );
  (
    service as unknown as {
      checkLocalModelAvailability: jest.Mock;
      selectBestLocalModel: jest.Mock;
    }
  ).selectBestLocalModel = jest.fn(() =>
    Promise.resolve(overrides?.bestLocalModel ?? 'llama3.2:3b'),
  );
  return { service, usage };
}

describe('CentralizedRoutingService showstopper behavior', () => {
  it('blocks remote route when showstopper and no local available', async () => {
    const { service } = makeService({
      showstopper: true,
      localAvailable: false,
    });
    const decision = await service.determineRoute('pii content', {
      providerName: 'openai',
      userId: 'u',
    });
    expect(decision.routeToAgent).toBe(false);
    expect(decision.provider).toBe('policy-blocked');
  });

  it('bypasses via local when showstopper and local available', async () => {
    const { service } = makeService({
      showstopper: true,
      localAvailable: true,
      bestLocalModel: 'qwen2.5:7b',
    });
    const decision = await service.determineRoute('pii content', {
      providerName: 'openai',
      userId: 'u',
    });
    expect(decision.routeToAgent).toBe(true);
    expect(decision.provider).toBe('ollama');
    expect(decision.model).toBe('qwen2.5:7b');
  });
});

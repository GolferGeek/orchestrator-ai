import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModelConfigurationService, SystemModelConfiguration, ModelConfiguration } from './model-configuration.service';
import * as fs from 'fs';

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] || {}, v as any);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ModelConfigurationService,
      useFactory: (configService: ConfigService) => {
        const json = configService.get<string>('MODEL_CONFIG_JSON');
        const path = configService.get<string>('MODEL_CONFIG_PATH');
        const patchJson = configService.get<string>('MODEL_CONFIG_PATCH_JSON');
        const globalJson = configService.get<string>('MODEL_CONFIG_GLOBAL_JSON');

        if ((json || path) && globalJson) {
          throw new Error('MODEL_CONFIG_GLOBAL_JSON is mutually exclusive with MODEL_CONFIG_JSON/MODEL_CONFIG_PATH');
        }

        let baseConfig: SystemModelConfiguration | undefined;
        let globalConfig: ModelConfiguration | undefined;
        if (globalJson) {
          try {
            globalConfig = JSON.parse(globalJson);
          } catch (parseError) {
            throw new Error(`Invalid MODEL_CONFIG_GLOBAL_JSON: ${(parseError as Error).message}. Value: ${globalJson}`);
          }
        }
        if (json) {
          baseConfig = JSON.parse(json);
        } else if (path) {
          const raw = fs.readFileSync(path, 'utf8');
          baseConfig = JSON.parse(raw);
        }

        if (!baseConfig && !globalConfig) {
          // Allow service construction; validation can be invoked by consumer
          return new ModelConfigurationService();
        }

        if (patchJson && baseConfig) {
          const patch = JSON.parse(patchJson);
          baseConfig = deepMerge(baseConfig, patch);
        }

        const service = new ModelConfigurationService(baseConfig ?? globalConfig);
        service.validateConfig();
        return service;
      },
      inject: [ConfigService],
    },
  ],
  exports: [ModelConfigurationService],
})
export class ModelConfigurationModule {}



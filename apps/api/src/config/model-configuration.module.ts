import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModelConfigurationService, SystemModelConfiguration } from './model-configuration.service';
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

        if (json && path) {
          throw new Error('MODEL_CONFIG_JSON and MODEL_CONFIG_PATH are mutually exclusive');
        }

        let baseConfig: SystemModelConfiguration | undefined;
        if (json) {
          baseConfig = JSON.parse(json);
        } else if (path) {
          const raw = fs.readFileSync(path, 'utf8');
          baseConfig = JSON.parse(raw);
        }

        if (!baseConfig) {
          // Allow service construction; validation can be invoked by consumer
          return new ModelConfigurationService();
        }

        if (patchJson) {
          const patch = JSON.parse(patchJson);
          baseConfig = deepMerge(baseConfig, patch);
        }

        const service = new ModelConfigurationService(baseConfig);
        service.validateConfig();
        return service;
      },
      inject: [ConfigService],
    },
  ],
  exports: [ModelConfigurationService],
})
export class ModelConfigurationModule {}



import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AgentPoolModule } from './agent-pool/agent-pool.module';
import { AgentDiscoveryService } from './agent-discovery.service';
import { DynamicAgentsController } from './agents/dynamic-agents.controller';
import supabaseConfig from './supabase/supabase.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../../.env.local', '../../../.env'],
      expandVariables: true,
      load: [supabaseConfig],
    }),
    HttpModule, // Add HttpModule for agent services
    SupabaseModule,
    AuthModule,
    HealthModule,
    AgentPoolModule,
  ],
  controllers: [AppController, DynamicAgentsController],
  providers: [
    AppService,
    AgentDiscoveryService,
    // TODO: Dynamic agents will be instantiated via discovery service
    // No need for hardcoded agent imports - everything is discovered dynamically
  ],
})
export class AppModule {}

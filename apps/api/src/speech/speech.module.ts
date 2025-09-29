import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';
import { SpeechService as DeepgramElevenLabsService } from './deepgram-elevenlabs.service';
import { AgentConversationsModule } from '../agent-conversations/agent-conversations.module';
import { TasksModule } from '../tasks/tasks.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    AgentConversationsModule,
    TasksModule,
    SupabaseModule,
  ],
  controllers: [SpeechController],
  providers: [SpeechService, DeepgramElevenLabsService],
  exports: [SpeechService, DeepgramElevenLabsService],
})
export class SpeechModule {}

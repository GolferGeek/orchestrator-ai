import { Injectable, Logger } from '@nestjs/common';
import { SpeechService as DeepgramElevenLabsService } from './deepgram-elevenlabs.service';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import { TasksService } from '../tasks/tasks.service';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import {
  ConversationRequestDto,
  ConversationResponseDto,
  TranscriptionResponseDto,
  SynthesizeResponseDto,
} from './dto/speech.dto';

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(
    private readonly deepgramElevenLabsService: DeepgramElevenLabsService,
    private readonly agentConversationsService: AgentConversationsService,
    private readonly tasksService: TasksService,
  ) {}

  async processConversation(
    request: ConversationRequestDto,
    currentUser: SupabaseAuthUserDto,
    authToken: string,
    agentName: string,
    agentType: string,
  ): Promise<ConversationResponseDto> {
    this.logger.log(
      `Starting conversation processing for agent ${agentName} (${agentType})`,
    );

    try {
      // Step 1: Transcribe the audio to text
      this.logger.debug('Step 1: Transcribing audio...');
      const transcription = await this.deepgramElevenLabsService.transcribeAudio(
        request.audioData,
        request.encoding,
        request.sampleRate,
      );

      if (!transcription.text || transcription.text.trim().length === 0) {
        throw new Error('No speech detected in audio');
      }

      this.logger.log(
        `Transcribed: "${transcription.text}" (confidence: ${transcription.confidence})`,
      );

      // Step 2: Get or create agent conversation
      this.logger.debug('Step 2: Getting agent conversation...');
      const conversation = await this.agentConversationsService.getOrCreateConversation(
        currentUser.id,
        agentName,
        agentType as any,
        request.conversationId,
      );

      // Step 3: Send the transcribed text through the task system
      this.logger.debug('Step 3: Processing through agent system...');
      
      // Create a task for this agent with the transcribed text
      const taskResult = await this.tasksService.createTask(
        currentUser.id,
        agentName,
        'specialist', // agentType
        {
          method: 'process',
          params: {},
          prompt: transcription.text.trim(),
          conversationId: conversation.id,
          metadata: {
            speechInput: true,
            transcriptionConfidence: transcription.confidence,
          },
        }
      );

      if (!taskResult || !taskResult.response) {
        throw new Error('No agent response received');
      }

      // Step 4: Convert the AI response to speech
      this.logger.debug('Step 4: Converting response to speech...');
      const responseText = taskResult.response;
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Agent response contains no text to synthesize');
      }

      const synthesizedAudio = await this.deepgramElevenLabsService.synthesizeText(
        responseText,
        // TODO: Could allow user preferences for voice settings
        'EXAVITQu4vr4xnSDxMaL', // Default to Bella voice from Eleven Labs
        0.5, // Default stability setting
      );

      // Step 5: Return the complete conversation result
      const result: ConversationResponseDto = {
        userMessageId: taskResult.id || 'temp-user-message',
        assistantMessageId: taskResult.id || 'temp-assistant-message',
        transcribedText: transcription.text,
        responseText: responseText,
        responseAudio: synthesizedAudio.audioData,
        metadata: {
          transcriptionConfidence: transcription.confidence,
          agentName: agentName,
          conversationId: conversation.id,
        },
      };

      this.logger.log(
        `Conversation processing completed for agent ${agentName}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Conversation processing failed:', error);
      
      // If we fail at any step, we should still try to provide a helpful audio response
      try {
        const errorMessage = `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
        const errorAudio = await this.deepgramElevenLabsService.synthesizeText(
          errorMessage,
          'EXAVITQu4vr4xnSDxMaL',
          0.5,
        );

        // Create a minimal error response
        const errorResponse: ConversationResponseDto = {
          userMessageId: 'error',
          assistantMessageId: 'error',
          transcribedText: 'Error processing audio',
          responseText: errorMessage,
          responseAudio: errorAudio.audioData,
          metadata: {
            transcriptionConfidence: 0,
            processingError: error instanceof Error ? error.message : 'Unknown error',
          },
        };

        return errorResponse;
      } catch (ttsError) {
        this.logger.error('Failed to generate error audio response:', ttsError);
        throw error; // Re-throw original error if we can't even generate error audio
      }
    }
  }

  async transcribeAudio(
    audioData: string,
    encoding?: string,
    sampleRate?: number,
  ): Promise<TranscriptionResponseDto> {
    this.logger.debug('Transcribing audio...');

    try {
      const result = await this.deepgramElevenLabsService.transcribeAudio(
        audioData,
        encoding,
        sampleRate,
      );

      return {
        text: result.text,
        confidence: result.confidence,
      };
    } catch (error) {
      this.logger.error('Audio transcription failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Audio transcription failed: ${errorMessage}`);
    }
  }

  async synthesizeText(
    text: string,
    voiceName?: string,
    speakingRate?: number,
  ): Promise<SynthesizeResponseDto> {
    this.logger.debug(`Synthesizing ${text.length} characters of text...`);

    try {
      const result = await this.deepgramElevenLabsService.synthesizeText(
        text,
        voiceName,
        speakingRate,
      );

      return {
        audioData: result.audioData,
        format: result.format,
      };
    } catch (error) {
      this.logger.error('Text synthesis failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Text synthesis failed: ${errorMessage}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.deepgramElevenLabsService.isHealthy();
    } catch (error) {
      this.logger.error('Speech service health check failed:', error);
      return false;
    }
  }
}

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Request,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { SpeechService } from './speech.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import {
  ConversationRequestDto,
  ConversationResponseDto,
  TranscribeAudioDto,
  TranscriptionResponseDto,
  SynthesizeTextDto,
  SynthesizeResponseDto,
} from './dto/speech.dto';

@ApiTags('Speech')
@Controller('speech')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpeechController {
  private readonly logger = new Logger(SpeechController.name);

  constructor(private readonly speechService: SpeechService) {}

  /**
   * Full conversation flow: audio input → process → audio response
   * POST /speech/agents/:agentName/:agentType/conversation
   */
  @Post('agents/:agentName/:agentType/conversation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a conversational speech request with a specific agent',
    description:
      'Takes audio input, transcribes it, processes through the specified AI agent, and returns spoken response',
  })
  @ApiParam({
    name: 'agentName',
    description: 'Name of the agent to process the conversation',
    example: 'blog_post_writer',
  })
  @ApiParam({
    name: 'agentType',
    description: 'Type of the agent (e.g., specialists, generalists)',
    example: 'specialists',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation processed successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid audio data or transcription failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 404,
    description: 'Agent not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during processing',
  })
  @ApiBody({ type: ConversationRequestDto })
  async processConversation(
    @Param('agentName') agentName: string,
    @Param('agentType') agentType: string,
    @Body() conversationRequest: ConversationRequestDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ): Promise<ConversationResponseDto> {
    this.logger.log(
      `Processing conversation for user ${currentUser.id} with agent ${agentName} (${agentType})`,
    );

    try {
      // Extract auth token from request
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.replace('Bearer ', '');

      if (!authToken) {
        throw new Error('No authentication token provided');
      }

      const startTime = Date.now();

      const _result = await this.speechService.processConversation(
        conversationRequest,
        currentUser,
        authToken,
        agentName,
        agentType,
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Conversation processed in ${processingTime}ms for agent ${agentName}`,
      );

      // Add processing time to metadata
      if (result.metadata) {
        result.metadata.processingTimeMs = processingTime;
      } else {
        result.metadata = { processingTimeMs: processingTime };
      }

      return result;
    } catch (_error) {
      this.logger.error('Conversation processing failed:', _error);
      const errorMessage =
        _error instanceof Error ? _error.message : 'Unknown _error';
      throw new Error(`Conversation processing failed: ${errorMessage}`);
    }
  }

  /**
   * Standalone audio transcription
   * POST /speech/transcribe
   */
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transcribe audio to text',
    description:
      'Converts audio input to text using Deepgram Speech-to-Text API',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio transcribed successfully',
    type: TranscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid audio data or transcription failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBody({ type: TranscribeAudioDto })
  async transcribeAudio(
    @Body() transcribeRequest: TranscribeAudioDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ): Promise<TranscriptionResponseDto> {
    this.logger.log(`Transcribing audio for user ${currentUser.id}`);

    try {
      const _result = await this.speechService.transcribeAudio(
        transcribeRequest.audioData,
        transcribeRequest.encoding,
        transcribeRequest.sampleRate,
      );

      this.logger.log(
        `Transcription completed: "${result.text}" (confidence: ${result.confidence})`,
      );

      return result;
    } catch (_error) {
      this.logger.error('Audio transcription failed:', _error);
      const errorMessage =
        _error instanceof Error ? _error.message : 'Unknown _error';
      throw new Error(`Audio transcription failed: ${errorMessage}`);
    }
  }

  /**
   * Standalone text-to-speech synthesis
   * POST /speech/synthesize
   */
  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synthesize text to speech',
    description: 'Converts text to audio using ElevenLabs Text-to-Speech API',
  })
  @ApiResponse({
    status: 200,
    description: 'Text synthesized to audio successfully',
    type: SynthesizeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid text or synthesis failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBody({ type: SynthesizeTextDto })
  async synthesizeText(
    @Body() synthesizeRequest: SynthesizeTextDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ): Promise<SynthesizeResponseDto> {
    this.logger.log(
      `Synthesizing ${synthesizeRequest.text.length} characters of text for user ${currentUser.id}`,
    );

    try {
      const _result = await this.speechService.synthesizeText(
        synthesizeRequest.text,
        synthesizeRequest.voiceName,
        synthesizeRequest.speakingRate,
      );

      this.logger.log('Text-to-speech synthesis completed');

      return result;
    } catch (_error) {
      this.logger.error('Text-to-speech synthesis failed:', _error);
      const errorMessage =
        _error instanceof Error ? _error.message : 'Unknown _error';
      throw new Error(`Text-to-speech synthesis failed: ${errorMessage}`);
    }
  }
}

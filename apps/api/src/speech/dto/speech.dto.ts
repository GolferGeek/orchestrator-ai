import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class TranscribeAudioDto {
  @ApiProperty({
    description: 'Base64 encoded audio data',
    example: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEA...',
  })
  @IsString()
  @IsNotEmpty()
  audioData!: string;

  @ApiProperty({
    description: 'Audio encoding format',
    example: 'webm',
    required: false,
  })
  @IsString()
  @IsOptional()
  encoding?: string;

  @ApiProperty({
    description: 'Sample rate of the audio',
    example: 48000,
    required: false,
  })
  @IsOptional()
  sampleRate?: number;
}

export class ConversationRequestDto {
  @ApiProperty({
    description: 'Agent conversation ID (optional - will be created if not provided)',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({
    description: 'Base64 encoded audio data',
    example: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEA...',
  })
  @IsString()
  @IsNotEmpty()
  audioData!: string;

  @ApiProperty({
    description: 'Audio encoding format',
    example: 'webm',
    required: false,
  })
  @IsString()
  @IsOptional()
  encoding?: string;

  @ApiProperty({
    description: 'Sample rate of the audio',
    example: 48000,
    required: false,
  })
  @IsOptional()
  sampleRate?: number;
}

export class SynthesizeTextDto {
  @ApiProperty({
    description: 'Text to convert to speech',
    example: 'Hello, I have completed the blog post as requested.',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({
    description: 'Voice name to use for TTS',
    example: 'en-US-Neural2-F',
    required: false,
  })
  @IsString()
  @IsOptional()
  voiceName?: string;

  @ApiProperty({
    description: 'Speaking rate (0.25 to 4.0)',
    example: 1.1,
    required: false,
  })
  @IsOptional()
  speakingRate?: number;
}

export class TranscriptionResponseDto {
  @ApiProperty({
    description: 'Transcribed text from audio',
    example: 'Write a blog post about artificial intelligence',
  })
  @IsString()
  text!: string;

  @ApiProperty({
    description: 'Confidence score of transcription (0-1)',
    example: 0.95,
  })
  confidence!: number;
}

export class ConversationResponseDto {
  @ApiProperty({
    description: 'ID of the user message created',
    format: 'uuid',
  })
  userMessageId!: string;

  @ApiProperty({
    description: 'ID of the assistant response message',
    format: 'uuid',
  })
  assistantMessageId!: string;

  @ApiProperty({
    description: 'Transcribed text from user audio',
    example: 'Write a blog post about artificial intelligence',
  })
  transcribedText!: string;

  @ApiProperty({
    description: 'Text response from the AI',
    example: 'I have written a comprehensive blog post about artificial intelligence. You can find it in the message above.',
  })
  responseText!: string;

  @ApiProperty({
    description: 'Base64 encoded audio response',
    example: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAA...',
  })
  responseAudio!: string;

  @ApiProperty({
    description: 'Processing metadata',
    required: false,
  })
  @IsOptional()
  metadata?: {
    transcriptionConfidence?: number;
    processingTimeMs?: number;
    agentName?: string;
    conversationId?: string;
    processingError?: string;
  };
}

export class SynthesizeResponseDto {
  @ApiProperty({
    description: 'Base64 encoded audio data',
    example: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAA...',
  })
  audioData!: string;

  @ApiProperty({
    description: 'Audio format/mimetype',
    example: 'audio/mp3',
  })
  format!: string;
}

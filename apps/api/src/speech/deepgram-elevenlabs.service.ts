import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// Deepgram configuration interface
interface DeepgramConfig {
  model: string;
  language: string;
  punctuate: boolean;
  smart_format: boolean;
  encoding: string;
  sample_rate: number;
}

// Eleven Labs configuration interface
interface ElevenLabsConfig {
  voice_id: string;
  model_id: string;
  voice_settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);
  private deepgramApiKey: string;
  private elevenLabsApiKey: string;

  constructor(private configService: ConfigService) {
    this.deepgramApiKey = this.configService.get('DEEPGRAM_API_KEY') || '';
    this.elevenLabsApiKey = this.configService.get('ELEVENLABS_API_KEY') || '';

    // Debug logging to see what's actually loaded
    this.logger.log(
      `Environment debug - DEEPGRAM_API_KEY: ${this.deepgramApiKey ? 'LOADED (length: ' + this.deepgramApiKey.length + ')' : 'NOT FOUND'}`,
    );
    this.logger.log(
      `Environment debug - ELEVENLABS_API_KEY: ${this.elevenLabsApiKey ? 'LOADED (length: ' + this.elevenLabsApiKey.length + ')' : 'NOT FOUND'}`,
    );

    // Validate API key format
    if (this.deepgramApiKey) {
      this.logger.log(
        `Deepgram API key starts with: ${this.deepgramApiKey.substring(0, 10)}...`,
      );
      if (this.deepgramApiKey.length < 20) {
        this.logger.warn('Deepgram API key seems too short - might be invalid');
      }
    }

    if (!this.deepgramApiKey) {
      this.logger.warn(
        'DEEPGRAM_API_KEY not configured - using placeholder responses',
      );
    }
    if (!this.elevenLabsApiKey) {
      this.logger.warn(
        'ELEVENLABS_API_KEY not configured - using placeholder responses',
      );
    }

    this.logger.log(
      'Speech services initialized with Deepgram and Eleven Labs',
    );
  }

  async transcribeAudio(
    audioData: string,
    encoding: string = 'webm',
    sampleRate: number = 48000,
  ): Promise<{ text: string; confidence: number }> {
    if (!this.deepgramApiKey) {
      // Return placeholder response when API key is not configured
      this.logger.warn(
        'Deepgram API key not configured, returning placeholder',
      );
      return {
        text: 'Placeholder transcription - Deepgram API not yet configured',
        confidence: 0.95,
      };
    }

    // First, test API key validity with a simple request
    try {
      const testResponse = await axios.get(
        'https://api.deepgram.com/v1/projects',
        {
          headers: {
            Authorization: `Token ${this.deepgramApiKey}`,
          },
          timeout: 10000,
        },
      );
      this.logger.log('Deepgram API key validation successful');
    } catch (_keyError) {
      this.logger.error('Deepgram API key validation failed:', keyError);
      if (axios.isAxiosError(keyError)) {
        const _status = keyError.response?.status;
        if (status === 401) {
          throw new Error('Deepgram API key is invalid or expired');
        } else if (status === 403) {
          throw new Error(
            'Deepgram API key does not have required permissions',
          );
        }
      }
      throw new Error('Failed to validate Deepgram API key');
    }

    try {
      // Convert base64 audio data to buffer
      const audioBuffer = this.base64ToBuffer(audioData);

      // Validate audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Invalid or empty audio data');
      }

      this.logger.log(
        `Processing audio: ${audioBuffer.length} bytes, format: ${encoding}`,
      );

      // Use minimal query parameters for containerized audio formats
      const queryParams = new URLSearchParams({
        model: 'nova-2',
        language: 'en-US',
        punctuate: 'true',
        smart_format: 'true',
      });

      this.logger.log(`Detected encoding format: ${encoding}`);

      // According to Deepgram docs: For containerized audio (OGG, WebM, MP4, etc),
      // do NOT set encoding/sample_rate - let Deepgram read the container headers
      // Only set encoding for raw audio streams like linear PCM
      const isContainerFormat = ['ogg', 'webm', 'mp4', 'm4a'].includes(
        encoding.toLowerCase(),
      );

      if (!isContainerFormat && encoding.toLowerCase() === 'wav') {
        // WAV might be raw PCM, so specify encoding
        queryParams.append('encoding', 'linear16');
        queryParams.append('sample_rate', sampleRate.toString());
        this.logger.log('Added WAV-specific parameters: linear16 encoding');
      } else {
        this.logger.log(
          `Using containerized format (${encoding}) - letting Deepgram auto-detect encoding`,
        );
      }

      const url = `https://api.deepgram.com/v1/listen?${queryParams}`;

      this.logger.log(`Deepgram API call: ${url}`);
      this.logger.log(
        `Audio format: ${encoding}, buffer size: ${audioBuffer.length} bytes`,
      );

      const headers: any = {
        Authorization: `Token ${this.deepgramApiKey}`,
      };

      // Set Content-Type for known formats, let Deepgram auto-detect for others
      if (encoding.toLowerCase() === 'wav') {
        headers['Content-Type'] = 'audio/wav';
      } else if (encoding.toLowerCase() === 'ogg') {
        headers['Content-Type'] = 'audio/ogg';
      } else if (encoding.toLowerCase() === 'mp4') {
        headers['Content-Type'] = 'audio/mp4';
      }
      // For webm and unknown formats, omit Content-Type for auto-detection

      this.logger.log(`Request headers:`, headers);

      const _response = await axios.post(url, audioBuffer, {
        headers,
        timeout: 30000, // 30 second timeout
      });

      const results = response.data?.results;
      if (!results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error('No speech recognized in audio');
      }

      const alternative = results.channels[0].alternatives[0];
      const text = alternative.transcript;
      const confidence = alternative.confidence || 0.0;

      this.logger.log(
        `Deepgram transcribed: "${text}" (confidence: ${confidence})`,
      );

      return { text, confidence };
    } catch (_error) {
      this.logger.error('Deepgram transcription failed:', error);

      if (axios.isAxiosError(error)) {
        const _status = error.response?.status;
        const responseData = error.response?.data;
        const message =
          responseData?.message ||
          responseData?.error ||
          responseData?.err_msg ||
          error.message;

        this.logger.error(`Deepgram API response status: ${status}`);
        this.logger.error(
          `Deepgram API response headers:`,
          error.response?.headers,
        );
        this.logger.error(
          `Deepgram API response data (full):`,
          JSON.stringify(responseData, null, 2),
        );
        this.logger.error(`Deepgram request URL: ${error.config?.url}`);
        this.logger.error(`Deepgram request headers:`, error.config?.headers);

        if (status === 400) {
          // Extract more detailed error information
          let detailedError = `Deepgram 400 error: ${message}`;
          if (responseData) {
            if (responseData.err_code)
              detailedError += ` (code: ${responseData.err_code})`;
            if (responseData.reason)
              detailedError += ` - Reason: ${responseData.reason}`;
            if (responseData.request_id)
              detailedError += ` - Request ID: ${responseData.request_id}`;
          }

          this.logger.error(`Detailed 400 error: ${detailedError}`);
          throw new Error(detailedError);
        }

        throw new Error(`Deepgram API error (${status}): ${message}`);
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Speech transcription failed: ${errorMessage}`);
    }
  }

  async synthesizeText(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL', // Default to Bella voice
    stability: number = 0.5,
  ): Promise<{ audioData: string; format: string }> {
    if (!this.elevenLabsApiKey) {
      // Return placeholder response when API key is not configured
      this.logger.warn(
        'Eleven Labs API key not configured, returning placeholder',
      );
      return {
        audioData: 'data:audio/mpeg;base64,placeholder-audio-data',
        format: 'audio/mpeg',
      };
    }

    try {
      const elevenLabsConfig: ElevenLabsConfig = {
        voice_id: voiceId,
        model_id: 'eleven_monolingual_v1', // Fast and high quality
        voice_settings: {
          stability: stability,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      };

      const requestBody = {
        text: text,
        model_id: elevenLabsConfig.model_id,
        voice_settings: elevenLabsConfig.voice_settings,
      };

      const _response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        requestBody,
        {
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey,
          },
          responseType: 'arraybuffer',
          timeout: 30000, // 30 second timeout
        },
      );

      if (!response.data) {
        throw new Error('No audio content generated');
      }

      // Convert audio buffer to base64
      const base64Audio = Buffer.from(response.data).toString('base64');
      const audioData = `data:audio/mpeg;base64,${base64Audio}`;

      this.logger.log(
        `Eleven Labs synthesized ${text.length} characters of text to audio`,
      );

      return {
        audioData,
        format: 'audio/mpeg',
      };
    } catch (_error) {
      this.logger.error('Eleven Labs synthesis failed:', error);

      if (axios.isAxiosError(error)) {
        const _status = error.response?.status;
        const message = error.response?.data?.detail?.message || error.message;
        throw new Error(`Eleven Labs API error (${status}): ${message}`);
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Text-to-speech synthesis failed: ${errorMessage}`);
    }
  }

  private base64ToBuffer(base64Data: string): Buffer {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
    return Buffer.from(cleanBase64, 'base64');
  }

  private mapDeepgramEncoding(encoding: string): string {
    // Map browser audio formats to Deepgram API formats
    // Note: Deepgram has issues with WebM/Opus - prefer linear16 when possible
    switch (encoding.toLowerCase()) {
      case 'webm':
        // WebM with Opus codec - Deepgram prefers this to be handled as 'webm'
        // but may have issues with raw Opus data
        return 'webm';
      case 'wav':
        return 'linear16'; // WAV is typically linear PCM
      case 'mp3':
        return 'mp3';
      case 'ogg':
        return 'ogg_opus'; // More specific for Ogg Opus
      case 'm4a':
        return 'm4a';
      default:
        this.logger.warn(
          `Unknown encoding format: ${encoding}, defaulting to webm`,
        );
        return 'webm';
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check if we have the required API keys
      const hasDeepgram = Boolean(this.deepgramApiKey);
      const hasElevenLabs = Boolean(this.elevenLabsApiKey);

      this.logger.debug(
        `Health check - Deepgram: ${hasDeepgram}, Eleven Labs: ${hasElevenLabs}`,
      );

      // Consider healthy if at least one service is configured
      return hasDeepgram || hasElevenLabs;
    } catch (_error) {
      this.logger.error('Health check failed:', _error);
      return false;
    }
  }
}

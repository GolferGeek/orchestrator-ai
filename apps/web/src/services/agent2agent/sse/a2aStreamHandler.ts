import { useAuthStore } from '@/stores/authStore';
import type {
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
  SSEConnectionOptions,
  SSEConnectionState,
} from '@orchestrator-ai/transport-types';
import { SSEClient } from './sseClient';

type ChunkHandler = (event: AgentStreamChunkSSEEvent['data']) => void;
type CompleteHandler = (event: AgentStreamCompleteSSEEvent['data']) => void;
type ErrorHandler = (event: AgentStreamErrorSSEEvent['data']) => void;
type StateHandler = (state: SSEConnectionState) => void;

interface StreamLifecycleHandlers {
  onChunk?: ChunkHandler;
  onComplete?: CompleteHandler;
  onError?: ErrorHandler;
  onStateChange?: StateHandler;
}

interface ConnectParams extends StreamLifecycleHandlers {
  metadata: Record<string, unknown>;
  connectionOptions?: SSEConnectionOptions;
}

interface NormalizedStreamMetadata {
  streamUrl: string;
  streamTokenUrl: string;
  streamId?: string;
  conversationId?: string | null;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_NESTJS_BASE_URL ||
  'http://localhost:7100';

export class A2AStreamHandler {
  private client: SSEClient;
  private metadata: NormalizedStreamMetadata | null = null;
  private handlers: StreamLifecycleHandlers = {};
  private authStore = useAuthStore();
  private disposeFns: Array<() => void> = [];

  constructor(defaultOptions?: SSEConnectionOptions) {
    this.client = new SSEClient(defaultOptions);
    this.disposeFns.push(
      this.client.onStateChange((state) => {
        this.handlers.onStateChange?.(state);
      }),
      this.client.onError((error) => {
        console.error('[SSE] stream error', error);
      }),
    );
  }

  async connect(params: ConnectParams): Promise<void> {
    this.metadata = this.normalizeMetadata(params.metadata);
    this.handlers = {
      onChunk: params.onChunk,
      onComplete: params.onComplete,
      onError: params.onError,
      onStateChange: params.onStateChange,
    };

    this.detachEventListeners();
    this.attachEventListeners();

    this.client.setReconnectUrlProvider(async () => {
      const nextUrl = await this.buildStreamUrl();
      return nextUrl;
    });

    const initialUrl = await this.buildStreamUrl();
    await this.client.connect(initialUrl);
  }

  disconnect(): void {
    this.detachEventListeners();
    this.client.disconnect();
    this.handlers = {};
    this.metadata = null;
  }

  getState(): SSEConnectionState {
    return this.client.readyState;
  }

  private attachEventListeners(): void {
    const disposers: Array<() => void> = [];

    disposers.push(
      this.client.addEventListener('agent_stream_chunk', (event) =>
        this.handleChunk(event),
      ),
      this.client.addEventListener('agent_stream_complete', (event) =>
        this.handleComplete(event),
      ),
      this.client.addEventListener('agent_stream_error', (event) =>
        this.handleError(event),
      ),
    );

    this.disposeFns.push(...disposers);
  }

  private detachEventListeners(): void {
    while (this.disposeFns.length) {
      const dispose = this.disposeFns.pop();
      try {
        dispose?.();
      } catch (error) {
        console.warn('[SSE] failed to cleanup listener', error);
      }
    }
  }

  private async buildStreamUrl(): Promise<string> {
    if (!this.metadata) {
      throw new Error('Cannot build stream URL without metadata');
    }

    const token = await this.fetchStreamToken();

    const url = new URL(this.metadata.streamUrl);
    if (this.metadata.streamId) {
      url.searchParams.set('streamId', this.metadata.streamId);
    }
    url.searchParams.set('token', token);

    return url.toString();
  }

  private async fetchStreamToken(): Promise<string> {
    if (!this.metadata) {
      throw new Error('Cannot fetch stream token without metadata');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authStore.token) {
      headers.Authorization = `Bearer ${this.authStore.token}`;
    }

    const response = await fetch(this.metadata.streamTokenUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        this.metadata.streamId ? { streamId: this.metadata.streamId } : {},
      ),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(
        `Failed to fetch stream token: ${response.status} ${errorText}`,
      );
    }

    const payload = await response.json();
    if (!payload?.token) {
      throw new Error('Stream token response missing token');
    }

    return payload.token as string;
  }

  private handleChunk(event: MessageEvent): void {
    console.log('[A2AStreamHandler] 📥 handleChunk called with event:', event);
    const data = this.safeParse<AgentStreamChunkSSEEvent['data']>(event.data);
    if (!data) {
      console.warn('[A2AStreamHandler] ⚠️ Failed to parse chunk data');
      return;
    }
    console.log('[A2AStreamHandler] ✅ Parsed chunk data:', {
      streamId: data.streamId,
      taskId: data.taskId,
      chunkType: data.chunk?.type,
      content: data.chunk?.content?.substring(0, 100),
    });
    this.handlers.onChunk?.(data);
    console.log('[A2AStreamHandler] 🎯 Called onChunk handler');
  }

  private handleComplete(event: MessageEvent): void {
    const data =
      this.safeParse<AgentStreamCompleteSSEEvent['data']>(event.data);
    if (!data) {
      return;
    }
    this.handlers.onComplete?.(data);
  }

  private handleError(event: MessageEvent): void {
    const data = this.safeParse<AgentStreamErrorSSEEvent['data']>(event.data);
    if (!data) {
      return;
    }

    this.handlers.onError?.(data);
  }

  private safeParse<T>(raw: unknown): T | null {
    if (typeof raw !== 'string') {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn('[SSE] failed to parse event payload', error);
      return null;
    }
  }

  private normalizeMetadata(metadata: Record<string, unknown>): NormalizedStreamMetadata {
    const streamingMeta = metadata.streaming ?? {};

    const streamUrl =
      this.coerceAbsoluteUrl(streamingMeta.streamUrl || metadata.streamUrl) ??
      this.coerceAbsoluteUrl(metadata.streamEndpoint) ??
      (() => {
        throw new Error('Stream metadata did not include a stream URL');
      })();

    const streamTokenUrl =
      this.coerceAbsoluteUrl(
        streamingMeta.streamTokenUrl || metadata.streamTokenUrl,
      ) ??
      this.coerceAbsoluteUrl(metadata.streamTokenEndpoint) ??
      (() => {
        throw new Error('Stream metadata did not include a stream token URL');
      })();

    return {
      streamUrl,
      streamTokenUrl,
      streamId: streamingMeta.streamId || metadata.streamId,
      conversationId:
        streamingMeta.conversationId ||
        metadata.conversationId ||
        metadata.conversation_id ||
        null,
    };
  }

  private coerceAbsoluteUrl(candidate: unknown): string | null {
    if (typeof candidate !== 'string' || candidate.length === 0) {
      return null;
    }

    try {
      return new URL(candidate, API_BASE_URL).toString();
    } catch {
      return null;
    }
  }
}

import axios from 'axios';

export interface OpenAIImageParams {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  n?: number;
}

export interface GeneratedImage {
  mime: string;
  base64: string;
}

export class OpenAIImageProvider {
  private readonly apiKey: string;
  private readonly apiBase: string;

  constructor(apiKey?: string, apiBase?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.apiBase = apiBase || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI image generation');
    }
  }

  async generate(params: OpenAIImageParams): Promise<GeneratedImage[]> {
    const n = params.n ?? 1;
    // Use images generation endpoint (DALL·E style); fallback model if needed
    const url = `${this.apiBase}/images/generations`;
    const body: any = {
      prompt: params.prompt,
      n,
      size: params.size || '512x512',
      response_format: 'b64_json',
    };
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    const resp = await axios.post(url, body, { headers });
    const data = resp.data?.data || [];
    const out: GeneratedImage[] = data.map((d: any) => ({ mime: 'image/png', base64: d.b64_json }));
    return out;
  }
}


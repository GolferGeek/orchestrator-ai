import axios from 'axios';

export interface GeminiImageParams {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  n?: number;
}

export interface GeneratedImage {
  mime: string;
  base64: string;
}

export class GeminiImageProvider {
  private readonly apiKey: string;
  private readonly apiBase: string;
  private readonly model: string;

  constructor(apiKey?: string, apiBase?: string, model?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY || '';
    this.apiBase = apiBase || process.env.GOOGLE_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = model || process.env.GOOGLE_IMAGE_MODEL || 'imagen-3.0';
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY is required for Gemini/Imagen image generation');
    }
  }

  async generate(params: GeminiImageParams): Promise<GeneratedImage[]> {
    // NOTE: Endpoint and payload schema may need adjustment based on exact Google API
    const n = params.n ?? 1;
    const size = params.size || '512x512';
    const url = `${this.apiBase}/models/${this.model}:generateImages?key=${encodeURIComponent(this.apiKey)}`;
    const body: any = {
      prompt: { text: params.prompt },
      // Map size to width/height if required by API; placeholder mapping
      // width: parseInt(size.split('x')[0], 10),
      // height: parseInt(size.split('x')[1], 10),
      // imageCount: n,
    };
    try {
      const resp = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
      const images = resp.data?.images || resp.data?.data || [];
      return images.map((i: any) => ({ mime: i.mimeType || 'image/png', base64: i.base64 || i.b64_json }));
    } catch (e) {
      // Fallback: return empty; caller can handle
      throw new Error(`Gemini/Imagen image generation failed: ${String(e?.response?.data || e?.message || e)}`);
    }
  }
}


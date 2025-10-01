import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createReadStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import { AssetsRepository, AssetRecord } from './assets.repository';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);
  private readonly backend = (process.env.ASSET_STORAGE_BACKEND || 'local') as 'local' | 'supabase';
  private readonly baseDir = resolve(process.env.IMAGE_STORAGE_DIR || './storage/images');

  constructor(private readonly repo: AssetsRepository) {}

  async ensureBaseDir() {
    if (this.backend !== 'local') return;
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (e) {
      this.logger.warn(`Failed to ensure image base dir: ${this.baseDir}: ${String(e)}`);
    }
  }

  async getMetadata(id: string): Promise<AssetRecord> {
    const rec = await this.repo.get(id);
    if (!rec) throw new NotFoundException('Asset not found');
    return rec;
  }

  getReadStream(id: string) {
    // Only local streaming is implemented in MVP
    return (async () => {
      const rec = await this.getMetadata(id);
      if (rec.storage !== 'local') {
        throw new NotFoundException('Streaming not available for this backend');
      }
      const p = rec.path ? join(this.baseDir, rec.path) : null;
      if (!p) throw new NotFoundException('Asset path missing');
      return { stream: createReadStream(p), mime: rec.mime };
    })();
  }
}


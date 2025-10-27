import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import type {
  HookEvent,
  FilterOptions,
  Theme,
  ThemeSearchQuery,
} from '../types';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  onModuleInit() {
    // Parse Supabase URL to get database connection details
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
    const url = new URL(supabaseUrl);
    const host = url.hostname;

    // Supabase local: PostgreSQL runs on port offset +2 from API (7010 -> 7012)
    const apiPort = parseInt(url.port || '7010');
    const pgPort = apiPort + 2;

    this.pool = new Pool({
      host: host,
      port: pgPort,
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.logger.log(`✅ PostgreSQL client initialized (${host}:${pgPort})`);
  }

  async insertEvent(event: HookEvent): Promise<HookEvent> {
    const timestamp = event.timestamp || Date.now();

    // Initialize humanInTheLoopStatus to pending if humanInTheLoop exists
    let humanInTheLoopStatus = event.humanInTheLoopStatus;
    if (event.humanInTheLoop && !humanInTheLoopStatus) {
      humanInTheLoopStatus = { status: 'pending' };
    }

    const query = `
      INSERT INTO observability.events (
        source_app, session_id, hook_event_type, payload, chat, summary,
        timestamp, human_in_the_loop, human_in_the_loop_status, model_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    const values = [
      event.source_app,
      event.session_id,
      event.hook_event_type,
      JSON.stringify(event.payload),
      event.chat ? JSON.stringify(event.chat) : null,
      event.summary || null,
      timestamp,
      event.humanInTheLoop ? JSON.stringify(event.humanInTheLoop) : null,
      humanInTheLoopStatus ? JSON.stringify(humanInTheLoopStatus) : null,
      event.model_name || null,
    ];

    const result = await this.pool.query(query, values);

    return {
      ...event,
      id: result.rows[0].id,
      timestamp,
      humanInTheLoopStatus,
    };
  }

  async getFilterOptions(): Promise<FilterOptions> {
    const queries = await Promise.all([
      this.pool.query(
        'SELECT DISTINCT source_app FROM observability.events ORDER BY source_app',
      ),
      this.pool.query(
        'SELECT DISTINCT session_id FROM observability.events ORDER BY session_id DESC LIMIT 300',
      ),
      this.pool.query(
        'SELECT DISTINCT hook_event_type FROM observability.events ORDER BY hook_event_type',
      ),
    ]);

    return {
      source_apps: queries[0].rows.map((row) => row.source_app),
      session_ids: queries[1].rows.map((row) => row.session_id),
      hook_event_types: queries[2].rows.map((row) => row.hook_event_type),
    };
  }

  async getRecentEvents(limit: number = 300): Promise<HookEvent[]> {
    const query = `
      SELECT * FROM observability.events
      ORDER BY timestamp DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);

    // Map database rows to HookEvent interface
    return result.rows
      .map((row) => ({
        id: row.id,
        source_app: row.source_app,
        session_id: row.session_id,
        hook_event_type: row.hook_event_type,
        payload:
          typeof row.payload === 'string'
            ? JSON.parse(row.payload)
            : row.payload,
        chat: row.chat
          ? typeof row.chat === 'string'
            ? JSON.parse(row.chat)
            : row.chat
          : undefined,
        summary: row.summary || undefined,
        timestamp: row.timestamp,
        humanInTheLoop: row.human_in_the_loop
          ? typeof row.human_in_the_loop === 'string'
            ? JSON.parse(row.human_in_the_loop)
            : row.human_in_the_loop
          : undefined,
        humanInTheLoopStatus: row.human_in_the_loop_status
          ? typeof row.human_in_the_loop_status === 'string'
            ? JSON.parse(row.human_in_the_loop_status)
            : row.human_in_the_loop_status
          : undefined,
        model_name: row.model_name || undefined,
      }))
      .reverse(); // Reverse to match original behavior (oldest first)
  }

  async updateEventHITLResponse(
    id: number,
    response: any,
  ): Promise<HookEvent | null> {
    const status = {
      status: 'responded',
      respondedAt: response.respondedAt,
      response,
    };

    const query = `
      UPDATE observability.events
      SET human_in_the_loop_status = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [JSON.stringify(status), id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      source_app: row.source_app,
      session_id: row.session_id,
      hook_event_type: row.hook_event_type,
      payload:
        typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      chat: row.chat
        ? typeof row.chat === 'string'
          ? JSON.parse(row.chat)
          : row.chat
        : undefined,
      summary: row.summary || undefined,
      timestamp: row.timestamp,
      humanInTheLoop: row.human_in_the_loop
        ? typeof row.human_in_the_loop === 'string'
          ? JSON.parse(row.human_in_the_loop)
          : row.human_in_the_loop
        : undefined,
      humanInTheLoopStatus: row.human_in_the_loop_status
        ? typeof row.human_in_the_loop_status === 'string'
          ? JSON.parse(row.human_in_the_loop_status)
          : row.human_in_the_loop_status
        : undefined,
      model_name: row.model_name || undefined,
    };
  }

  // Theme database functions
  async insertTheme(theme: Theme): Promise<Theme> {
    const query = `
      INSERT INTO observability.themes (
        id, name, display_name, description, colors, is_public,
        author_id, author_name, created_at, updated_at, tags,
        download_count, rating, rating_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    const values = [
      theme.id,
      theme.name,
      theme.displayName,
      theme.description || null,
      JSON.stringify(theme.colors),
      theme.isPublic,
      theme.authorId || null,
      theme.authorName || null,
      new Date(theme.createdAt),
      new Date(theme.updatedAt),
      JSON.stringify(theme.tags || []),
      theme.downloadCount || 0,
      theme.rating || null,
      theme.ratingCount || 0,
    ];

    await this.pool.query(query, values);
    return theme;
  }

  async updateTheme(id: string, updates: Partial<Theme>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.colors !== undefined) {
      fields.push(`colors = $${paramIndex++}`);
      values.push(JSON.stringify(updates.colors));
    }
    if (updates.isPublic !== undefined) {
      fields.push(`is_public = $${paramIndex++}`);
      values.push(updates.isPublic);
    }
    if (updates.tags !== undefined) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.updatedAt !== undefined) {
      fields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date(updates.updatedAt));
    }

    if (fields.length === 0) {
      return true;
    }

    values.push(id);
    const query = `
      UPDATE observability.themes
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.pool.query(query, values);
    return true;
  }

  async getTheme(id: string): Promise<Theme | null> {
    const query = 'SELECT * FROM observability.themes WHERE id = $1';
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      colors:
        typeof row.colors === 'string' ? JSON.parse(row.colors) : row.colors,
      isPublic: row.is_public,
      authorId: row.author_id,
      authorName: row.author_name,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      tags: row.tags
        ? typeof row.tags === 'string'
          ? JSON.parse(row.tags)
          : row.tags
        : [],
      downloadCount: row.download_count,
      rating: row.rating,
      ratingCount: row.rating_count,
    };
  }

  async getThemes(query: ThemeSearchQuery = {}): Promise<Theme[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (query.isPublic !== undefined) {
      conditions.push(`is_public = $${paramIndex++}`);
      values.push(query.isPublic);
    }

    if (query.authorId) {
      conditions.push(`author_id = $${paramIndex++}`);
      values.push(query.authorId);
    }

    if (query.query) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`,
      );
      values.push(`%${query.query}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Apply sorting
    const sortColumn =
      {
        name: 'name',
        created: 'created_at',
        updated: 'updated_at',
        downloads: 'download_count',
        rating: 'rating',
      }[query.sortBy || 'created'] || 'created_at';

    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Apply pagination
    let limitClause = '';
    if (query.limit) {
      limitClause = `LIMIT $${paramIndex++}`;
      values.push(query.limit);

      if (query.offset) {
        limitClause += ` OFFSET $${paramIndex++}`;
        values.push(query.offset);
      }
    }

    const sql = `
      SELECT * FROM observability.themes
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      ${limitClause}
    `;

    const result = await this.pool.query(sql, values);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      colors:
        typeof row.colors === 'string' ? JSON.parse(row.colors) : row.colors,
      isPublic: row.is_public,
      authorId: row.author_id,
      authorName: row.author_name,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      tags: row.tags
        ? typeof row.tags === 'string'
          ? JSON.parse(row.tags)
          : row.tags
        : [],
      downloadCount: row.download_count,
      rating: row.rating,
      ratingCount: row.rating_count,
    }));
  }

  async deleteTheme(id: string): Promise<boolean> {
    const query = 'DELETE FROM observability.themes WHERE id = $1';
    await this.pool.query(query, [id]);
    return true;
  }

  async incrementThemeDownloadCount(id: string): Promise<boolean> {
    const query = `
      UPDATE observability.themes
      SET download_count = download_count + 1
      WHERE id = $1
    `;
    await this.pool.query(query, [id]);
    return true;
  }
}

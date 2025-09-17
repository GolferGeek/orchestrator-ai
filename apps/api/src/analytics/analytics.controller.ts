import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('analytics')
export class AnalyticsController {
  /**
   * Minimal event ingest endpoint for frontend analytics.
   * Intentionally no-op in dev; returns success immediately.
   */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  async trackEvent(@Body() _event: any): Promise<{ success: boolean }> {
    // In development, we don't persist analytics. Avoid noisy errors.
    return { success: true };
  }

  /**
   * Batch ingest endpoint (optional usage by frontend).
   */
  @Post('events/batch')
  @HttpCode(HttpStatus.OK)
  async trackEventBatch(@Body() _payload: any): Promise<{ success: boolean }> {
    return { success: true };
  }
}


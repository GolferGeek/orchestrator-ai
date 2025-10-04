import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller('hierarchy')
export class HierarchySimpleController {
  private readonly logger = new Logger(HierarchySimpleController.name);

  /**
   * Test endpoint
   * Route: GET /hierarchy/test
   */
  @Get('test')
  @Public()
  async testHierarchy() {
    return {
      message: 'Hierarchy controller working',
      timestamp: new Date().toISOString(),
    };
  }
}

import { Controller, Get, Headers } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('agents')
  async getAgentStatus(
    @Headers('x-agent-namespace') namespaceHeader?: string,
  ): Promise<any> {
    const namespaces = namespaceHeader
      ? namespaceHeader
          .split(',')
          .map((ns) => ns.trim())
          .filter(Boolean)
      : undefined;

    return await this.appService.getAgentStatus(namespaces);
  }
}

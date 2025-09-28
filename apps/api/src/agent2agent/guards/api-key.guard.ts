import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-agent-api-key'] || request.headers['x-api-key'];

    if (!apiKey) {
      // For now we log and allow, future iterations will enforce key validation.
      this.logger.debug('No API key provided; allowing request (placeholder guard).');
      return true;
    }

    // TODO: Integrate with organization credential store / key validation service.
    return true;
  }
}

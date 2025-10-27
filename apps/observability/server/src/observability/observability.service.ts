import { Injectable, Logger } from '@nestjs/common';
import { WebSocket as WSWebSocket } from 'ws';
import type { HumanInTheLoopResponse } from '../types';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  async sendResponseToAgent(
    wsUrl: string,
    response: HumanInTheLoopResponse,
  ): Promise<void> {
    this.logger.log(`[HITL] Connecting to agent WebSocket: ${wsUrl}`);

    return new Promise((resolve, reject) => {
      let ws: WSWebSocket | null = null;
      let isResolved = false;

      const cleanup = () => {
        if (ws) {
          try {
            ws.close();
          } catch (e) {
            // Ignore close errors
          }
        }
      };

      try {
        ws = new WSWebSocket(wsUrl);

        ws.on('open', () => {
          if (isResolved) return;
          this.logger.log(
            '[HITL] WebSocket connection opened, sending response...',
          );

          try {
            ws!.send(JSON.stringify(response));
            this.logger.log('[HITL] Response sent successfully');

            // Wait longer to ensure message fully transmits before closing
            setTimeout(() => {
              cleanup();
              if (!isResolved) {
                isResolved = true;
                resolve();
              }
            }, 500);
          } catch (error) {
            this.logger.error('[HITL] Error sending message:', error);
            cleanup();
            if (!isResolved) {
              isResolved = true;
              reject(error);
            }
          }
        });

        ws.on('error', (error) => {
          this.logger.error('[HITL] WebSocket error:', error);
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(error);
          }
        });

        ws.on('close', () => {
          this.logger.log('[HITL] WebSocket connection closed');
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!isResolved) {
            this.logger.error('[HITL] Timeout sending response to agent');
            cleanup();
            isResolved = true;
            reject(new Error('Timeout sending response to agent'));
          }
        }, 5000);
      } catch (error) {
        this.logger.error('[HITL] Error creating WebSocket:', error);
        cleanup();
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      }
    });
  }
}

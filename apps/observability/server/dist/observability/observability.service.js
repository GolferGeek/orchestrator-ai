"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ObservabilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityService = void 0;
const common_1 = require("@nestjs/common");
const ws_1 = require("ws");
let ObservabilityService = ObservabilityService_1 = class ObservabilityService {
    constructor() {
        this.logger = new common_1.Logger(ObservabilityService_1.name);
    }
    async sendResponseToAgent(wsUrl, response) {
        this.logger.log(`[HITL] Connecting to agent WebSocket: ${wsUrl}`);
        return new Promise((resolve, reject) => {
            let ws = null;
            let isResolved = false;
            const cleanup = () => {
                if (ws) {
                    try {
                        ws.close();
                    }
                    catch (e) {
                    }
                }
            };
            try {
                ws = new ws_1.WebSocket(wsUrl);
                ws.on('open', () => {
                    if (isResolved)
                        return;
                    this.logger.log('[HITL] WebSocket connection opened, sending response...');
                    try {
                        ws.send(JSON.stringify(response));
                        this.logger.log('[HITL] Response sent successfully');
                        setTimeout(() => {
                            cleanup();
                            if (!isResolved) {
                                isResolved = true;
                                resolve();
                            }
                        }, 500);
                    }
                    catch (error) {
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
                setTimeout(() => {
                    if (!isResolved) {
                        this.logger.error('[HITL] Timeout sending response to agent');
                        cleanup();
                        isResolved = true;
                        reject(new Error('Timeout sending response to agent'));
                    }
                }, 5000);
            }
            catch (error) {
                this.logger.error('[HITL] Error creating WebSocket:', error);
                cleanup();
                if (!isResolved) {
                    isResolved = true;
                    reject(error);
                }
            }
        });
    }
};
exports.ObservabilityService = ObservabilityService;
exports.ObservabilityService = ObservabilityService = ObservabilityService_1 = __decorate([
    (0, common_1.Injectable)()
], ObservabilityService);
//# sourceMappingURL=observability.service.js.map
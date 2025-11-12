"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const logger = new common_1.Logger('Bootstrap');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors();
    const port = configService.get('LANGGRAPH_PORT') || 7200;
    const host = configService.get('LANGGRAPH_HOST') || '0.0.0.0';
    await app.listen(port, host);
    logger.log(`🚀 LangGraph application is running on: http://${host}:${port}`);
    logger.log(`📊 Health check: http://${host}:${port}/health`);
    logger.log(`🔄 Workflows: http://${host}:${port}/workflows/*`);
}
bootstrap();
//# sourceMappingURL=main.js.map
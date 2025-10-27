import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { ObservabilityModule } from './observability/observability.module';
import { ThemesModule } from './themes/themes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../../.env'),
        join(process.cwd(), '.env'),
      ],
      expandVariables: true,
    }),
    DatabaseModule,
    ObservabilityModule,
    ThemesModule,
  ],
})
export class AppModule {}

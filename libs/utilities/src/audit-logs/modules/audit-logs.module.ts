import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpModuleAsyncOptions } from '@nestjs/axios';
import { AuditLogsService } from '../services';

@Global()
@Module({})
export class AuditLogsModule {
  public static forRoot(options?: HttpModuleAsyncOptions): DynamicModule {
    return {
      module: AuditLogsModule,
      imports: [
        ConfigModule,
        HttpModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) =>
            Object.assign(
              {
                timeout: configService.get('HTTP_TIMEOUT') ?? 5000,
                maxRedirects: configService.get('HTTP_MAX_REDIRECTS') ?? 2,
                baseURL: configService.get('AUDIT_LOG_API_HOST'),
                headers: {
                  Authorization: `Bearer ${configService.get('AUDIT_LOG_API_TOKEN')}`,
                  'Content-Type': 'application/json',
                },
              },
              options,
            ),
        }),
      ],
      providers: [AuditLogsService],
      exports: [AuditLogsService],
    };
  }
}

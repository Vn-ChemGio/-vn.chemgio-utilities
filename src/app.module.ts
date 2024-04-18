import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabasesModule } from '@unifygpt.ai/utilities';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuditLogsModule } from '@unifygpt.ai/utilities/audit-logs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DatabasesModule.forRoot({}),
    AuditLogsModule.forRoot({}),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

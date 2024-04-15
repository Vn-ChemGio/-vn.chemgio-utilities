import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabasesModule } from '@unifygpt.ai/utilities';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConfigModule.forRoot(), DatabasesModule.forRoot({}), UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

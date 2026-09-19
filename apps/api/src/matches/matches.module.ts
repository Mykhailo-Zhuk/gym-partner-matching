import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { RemindersModule } from '../reminders/reminders.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [ChatModule, RemindersModule],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}

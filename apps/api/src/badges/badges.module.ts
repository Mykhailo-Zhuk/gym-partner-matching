import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService], // DashboardModule + ReferralsModule wire rule hooks
})
export class BadgesModule {}

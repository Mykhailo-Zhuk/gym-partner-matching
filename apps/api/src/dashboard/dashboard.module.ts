import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { RemindersModule } from '../reminders/reminders.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

/** Part 4 — shared dashboard (#2) + ratings (#5). Part 5 (#10) badge hooks ride along. */
@Module({
  imports: [RemindersModule, BadgesModule],
  controllers: [DashboardController, RatingsController],
  providers: [DashboardService, RatingsService],
})
export class DashboardModule {}

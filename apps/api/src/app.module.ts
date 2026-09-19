import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { UserStatusGuard } from './common/guards/user-status.guard';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { GymsModule } from './gyms/gyms.module';
import { MatchingModule } from './matching/matching.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { DevicesModule } from './devices/devices.module';
import { UploadsModule } from './uploads/uploads.module';
import { ChatModule } from './chat/chat.module';
import { MatchesModule } from './matches/matches.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BullRootModule } from './reminders/reminders.module';
import { BadgesModule } from './badges/badges.module';
import { ReferralsModule } from './referrals/referrals.module';
import { GroupsModule } from './groups/groups.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    PrismaModule,
    NotificationsModule,
    AuditModule,
    AuthModule,
    GymsModule,
    MatchingModule,
    ReportsModule,
    AdminModule,
    DevicesModule,
    UploadsModule,
    BullRootModule, // Part 3B — shared BullMQ/Redis connection
    ChatModule, // Part 3A
    MatchesModule, // Part 3 (schedule / en-route / end)
    DashboardModule, // Part 4 (dashboard #2 + ratings #5)
    BadgesModule, // Part 5 (#10) — engine + sheet; depends on NotificationsModule only
    ReferralsModule, // Part 5 (#9) — depends on BadgesModule
    GroupsModule, // Part 5 (#11) — depends on Chat/Notifications/Reminders
    UsersModule, // Part 2 (#8)
  ],
  controllers: [HealthController],
  providers: [
    // Guard order: authenticate -> reject blocked users (UserGuard) -> role checks
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserStatusGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

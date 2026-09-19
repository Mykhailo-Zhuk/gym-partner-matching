import { Module } from '@nestjs/common';
import { ReferralsModule } from '../referrals/referrals.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocialVerifier } from './social-verifier';

@Module({
  imports: [ReferralsModule],
  controllers: [AuthController],
  providers: [AuthService, SocialVerifier],
  exports: [AuthService],
})
export class AuthModule {}

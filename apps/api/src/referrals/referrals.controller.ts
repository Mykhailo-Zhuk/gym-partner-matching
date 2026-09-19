import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReferralsService } from './referrals.service';

@ApiTags('referrals')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('code')
  @ApiOperation({ summary: 'My referral code + share link + redemption count (story #9 — "Запросити друга")' })
  myCode(@CurrentUser('id') userId: string) {
    return this.referrals.myCode(userId);
  }
}

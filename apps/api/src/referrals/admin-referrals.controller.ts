import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ReferralsService } from './referrals.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/referrals')
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Referral funnel for the admin panel (story #9): total codes, total granted, top referrers' })
  stats() {
    return this.referrals.adminStats();
  }
}

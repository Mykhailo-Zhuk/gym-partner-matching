import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BadgesService } from './badges.service';

@ApiTags('badges')
@ApiBearerAuth()
@Controller('users/me/badges')
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  @Get()
  @ApiOperation({
    summary:
      'My badge sheet (story #10): earned + locked with unlock conditions. Locked badges include the rule slug the engine evaluates.',
  })
  mySheet(@CurrentUser('id') userId: string) {
    return this.badges.sheet(userId);
  }
}

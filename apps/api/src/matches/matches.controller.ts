import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@ApiBearerAuth()
@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'My matches (partner card + scheduled time + last chat message)' })
  list(@CurrentUser('id') userId: string) {
    return this.matches.myMatches(userId);
  }

  @Patch(':id/schedule')
  @ApiOperation({
    summary:
      'Set/move/cancel meetup time (story #4: reminders need scheduled_at). Passing null cancels; pending reminder pushes are invalidated on every change.',
  })
  schedule(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: ScheduleMatchDto,
  ) {
    return this.matches.schedule(matchId, userId, dto.scheduledAt);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End the match. Leaves no orphan reminder jobs behind.' })
  end(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) matchId: string) {
    return this.matches.end(matchId, userId);
  }

  @Post(':id/en-route')
  @ApiOperation({
    summary:
      'Story #4 "Я в дорозі" action: pushes the partner and posts a system message ("… в дорозі 🚗") into the match chat.',
  })
  enRoute(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) matchId: string) {
    return this.matches.enRoute(matchId, userId);
  }
}

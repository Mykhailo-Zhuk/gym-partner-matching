import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('matches')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Post(':id/workouts')
  @ApiOperation({
    summary:
      'Story #2: manual workout entry (date, type, sets/reps/weight). Visible to both partners; goal progress is re-evaluated on every write.',
  })
  addWorkout(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.dashboard.addWorkout(matchId, userId, dto);
  }

  @Get(':id/dashboard')
  @ApiOperation({
    summary:
      'Story #2: shared calendar (who attended), aggregates (workout count, total kg, weekly streak) and goals with live progress. All math is server-side — both partners read identical numbers.',
  })
  getDashboard(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) matchId: string) {
    return this.dashboard.dashboard(matchId, userId);
  }

  @Post(':id/goals')
  @ApiOperation({
    summary:
      'Story #2: propose a joint goal. Stays PENDING_CONFIRM until the partner confirms (they get a push).',
  })
  createGoal(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.dashboard.createGoal(matchId, userId, dto);
  }

  @Post(':id/goals/:goalId/confirm')
  @ApiOperation({ summary: 'Story #2: partner confirms a proposed goal -> it becomes ACTIVE.' })
  confirmGoal(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
  ) {
    return this.dashboard.confirmGoal(matchId, goalId, userId);
  }
}

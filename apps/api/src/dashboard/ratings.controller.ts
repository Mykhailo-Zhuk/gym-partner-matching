import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompleteMatchDto } from './dto/complete-match.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post('matches/:id/complete')
  @ApiOperation({
    summary:
      'Story #5: "Завершити тренування". Ends the match; optional 3x5-star rating + comment. Empty body = "Пропустити" (ratingSkipped=true -> "Завершено без оцінки").',
  })
  complete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: CompleteMatchDto,
  ) {
    return this.ratings.complete(matchId, userId, dto);
  }

  @Get('users/:id/rating-summary')
  @ApiOperation({
    summary:
      'Story #5: reputation card — average score (e.g. 4.7), rating count, last 3 comments. Shown on profile/search cards BEFORE a match request.',
  })
  ratingSummary(@Param('id', ParseUUIDPipe) userId: string) {
    return this.ratings.ratingSummary(userId);
  }
}

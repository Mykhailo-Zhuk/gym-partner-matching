import { Controller, Get, Param, Post, Query, UseGuards, Body, Request } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Goal, Level } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { MatchingService } from './matching.service';
import { CreateRequestDto } from './dto/request.dto';

class PreviewQuery {
  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @IsOptional()
  @IsUUID()
  gym_id?: string;
}

class SearchQuery {
  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  schedule?: string;

  @IsOptional()
  @IsUUID()
  gym_id?: string;
}

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  // Pre-auth preview (story #6)
  @Public()
  @Get('preview')
  @UseGuards(new RateLimitGuard())
  @ApiOperation({ summary: 'Pre-auth partner preview: 3–5 ANONYMIZED cards' })
  preview(@Query() query: PreviewQuery) {
    return this.matching.preview({ goal: query.goal, level: query.level, gymId: query.gym_id });
  }

  // Auth search (Part 2 #1)
  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search for potential partners with filters' })
  search(@Request() req: { user: { id: string } }, @Query() query: SearchQuery) {
    return this.matching.search(req.user.id, {
      level: query.level,
      goal: query.goal,
      schedule: query.schedule,
      gymId: query.gym_id,
    });
  }

  // Send request (Part 2 #1)
  @UseGuards(JwtAuthGuard)
  @Post('requests')
  @ApiOperation({ summary: 'Send a match request to a user' })
  createRequest(@Request() req: { user: { id: string } }, @Body() body: CreateRequestDto) {
    return this.matching.createRequest(req.user.id, body.to_user_id);
  }

  // List incoming requests (Part 2 #1)
  @UseGuards(JwtAuthGuard)
  @Get('requests/incoming')
  @ApiOperation({ summary: 'List incoming match requests' })
  listIncoming(@Request() req: { user: { id: string } }) {
    return this.matching.listIncomingRequests(req.user.id);
  }

  // Accept/Decline request (Part 2 #1)
  @UseGuards(JwtAuthGuard)
  @Post('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a match request' })
  acceptRequest(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.matching.respondToRequest(id, req.user.id, true);
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests/:id/decline')
  @ApiOperation({ summary: 'Decline a match request' })
  declineRequest(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.matching.respondToRequest(id, req.user.id, false);
  }
}

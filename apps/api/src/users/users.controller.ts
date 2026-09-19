import { Body, Controller, Get, Patch, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService, UpdateProfileDto } from './users.service';
import { Goal, Level } from '@prisma/client';

class UpdateProfileDtoImpl implements UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  schedule?: string;

  @IsOptional()
  @IsUUID()
  gym_id?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Request() req: { user: { id: string } }) {
    return this.users.findById(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@Request() req: { user: { id: string } }, @Body() body: UpdateProfileDtoImpl) {
    return this.users.updateProfile(req.user.id, {
      name: body.name,
      bio: body.bio,
      level: body.level,
      goal: body.goal,
      schedule: body.schedule,
      gymId: body.gym_id,
      photoUrl: body.photo_url,
    });
  }
}

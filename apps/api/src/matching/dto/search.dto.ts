import { ApiPropertyOptional } from '@nestjs/swagger';
import { Goal, Level } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class SearchQuery {
  @ApiPropertyOptional({ enum: Goal })
  @IsOptional()
  @IsEnum(Goal)
  level?: Level;

  @ApiPropertyOptional({ enum: Goal })
  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @ApiPropertyOptional()
  @IsOptional()
  schedule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gym_id?: string;
}

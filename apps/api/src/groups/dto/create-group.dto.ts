import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Ранкова група Поділ' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional({ example: '2026-08-30T07:00:00.000Z', description: 'Planned workout time; required for the T-24h creator reminder (#11)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiProperty({ type: [String], description: 'User IDs to invite (1..4 — creator + 1..4 = 2..5 total)', example: [] })
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  inviteeIds!: string[];
}

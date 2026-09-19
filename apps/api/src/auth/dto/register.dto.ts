import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Goal, Level } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'ivan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Іван' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  // --- Onboarding selections (story #6) captured pre-auth, transferred at registration ---
  @ApiPropertyOptional({ enum: Goal, example: Goal.MASS })
  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @ApiPropertyOptional({ enum: Level, example: Level.BEGINNER })
  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @ApiPropertyOptional({ description: 'Gym picked during onboarding' })
  @IsOptional()
  @IsUUID()
  gymId?: string;

  // Part 5 (#9): optional referral code captured during onboarding. Invalid codes
  // are surfaced as 400 with the exact Gherkin message.
  @ApiPropertyOptional({ example: 'K3D9X42P', description: 'Referral code (story #9). Invalid -> 400 "Код не знайдено".' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}

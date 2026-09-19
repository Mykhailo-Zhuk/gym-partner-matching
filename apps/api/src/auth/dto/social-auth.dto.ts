import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Goal, Level, SocialProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SocialAuthDto {
  @ApiProperty({ enum: SocialProvider })
  @IsEnum(SocialProvider)
  provider!: SocialProvider;

  @ApiProperty({ description: 'Firebase-verified ID token. Dev-only format without FCM: dev:<uid>:<email>:<name>' })
  @IsString()
  idToken!: string;

  // Onboarding selections transferred when the social sign-in creates a NEW account.
  @ApiPropertyOptional({ enum: Goal })
  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @ApiPropertyOptional({ enum: Level })
  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gymId?: string;

  // Part 5 (#9): optional referral code. Bad code is silently ignored for
  // social sign-in (the Gherkin 400 path is reserved for the email/password
  // onboarding flow where the user typed the code themselves).
  @ApiPropertyOptional({ example: 'K3D9X42P', description: 'Referral code (story #9). Invalid codes are ignored on social sign-in.' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}

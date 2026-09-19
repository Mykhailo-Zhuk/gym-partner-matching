import { GoalMetric } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateGoalDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string; // e.g. "10 тренувань за червень"

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  target: number;

  @IsEnum(GoalMetric)
  metric: GoalMetric; // WORKOUT_COUNT | TOTAL_KG

  @IsOptional()
  @IsDateString()
  due?: string;
}

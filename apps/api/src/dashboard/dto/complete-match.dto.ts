import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class RatingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  punctuality: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  communication: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  spotting: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class CompleteMatchDto {
  /** Omit (or send nothing) = the "Пропустити" path: match ends unrated. */
  @IsOptional()
  @ValidateNested()
  @Type(() => RatingDto)
  rating?: RatingDto;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, ValidateIf } from 'class-validator';

export class ScheduleMatchDto {
  @ApiProperty({
    description: 'Planned workout start (ISO 8601), or null to cancel. Drives T-60/T-15 reminders (story #4).',
    example: '2026-08-24T19:00:00.000Z',
    nullable: true,
  })
  @ValidateIf((o: ScheduleMatchDto) => o.scheduledAt !== null)
  @IsDateString()
  scheduledAt!: string | null;
}

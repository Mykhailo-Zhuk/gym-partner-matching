import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

export class CreateReportDto {
  @ApiProperty({ description: 'User being reported' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ example: 'Недоречні повідомлення' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'File a report against another user (feeds the admin panel, story #3)' })
  create(@CurrentUser('id') reporterId: string, @Body() dto: CreateReportDto) {
    return this.reports.create(reporterId, dto);
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export enum SendMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
}

export class SendMessageDto {
  @ApiProperty({ enum: SendMessageType, example: 'TEXT' })
  @IsEnum(SendMessageType)
  type!: SendMessageType;

  @ApiPropertyOptional({ example: 'Домовились на 19:00 біля стійки?' })
  @ValidateIf((o: SendMessageDto) => o.type === SendMessageType.TEXT || o.body !== undefined)
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({ description: 'fileUrl from POST /uploads/presign (kind=chat)', example: 'http://localhost:9100/gymbros-uploads/chat/…/….jpg' })
  @ValidateIf((o: SendMessageDto) => o.type === SendMessageType.IMAGE)
  @IsString()
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @ApiPropertyOptional({ description: 'Image caption (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;
}

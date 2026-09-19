import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { SendMessageType } from '../../chat/dto/send-message.dto';

export class SendGroupMessageDto {
  @ApiProperty({ enum: SendMessageType, example: SendMessageType.TEXT })
  @IsEnum(SendMessageType)
  type!: SendMessageType;

  @ApiPropertyOptional({ example: 'Хтось ще йде на 19:00?' })
  @ValidateIf((o: SendGroupMessageDto) => o.type === SendMessageType.TEXT || o.body !== undefined)
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({ description: 'fileUrl from POST /uploads/presign (kind=chat)' })
  @ValidateIf((o: SendGroupMessageDto) => o.type === SendMessageType.IMAGE)
  @IsString()
  @IsUrl({ require_tld: false })
  mediaUrl?: string;
}

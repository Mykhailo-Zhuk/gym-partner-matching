import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

class PresignDto {
  @ApiProperty({ enum: ['avatar', 'chat'] })
  @IsIn(['avatar', 'chat'])
  kind!: 'avatar' | 'chat';

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @Matches(/^image\/(jpeg|png|webp)$/, { message: 'Only jpeg/png/webp images are allowed' })
  contentType!: string;
}

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Presigned PUT URL for a photo upload (avatars #8, chat photos #7)' })
  presign(@CurrentUser('id') userId: string, @Body() dto: PresignDto) {
    return this.uploads.presign(userId, dto.kind, dto.contentType);
  }
}

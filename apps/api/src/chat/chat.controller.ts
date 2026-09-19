import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('matches/:matchId/messages')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  @ApiQuery({ name: 'before', required: false, description: 'Cursor: message id of the oldest loaded message' })
  @ApiQuery({ name: 'limit', required: false, schema: { default: 50, maximum: 100 } })
  @ApiOperation({
    summary: 'Chat history (story #7), newest page first. Only ACTIVE match participants.',
  })
  list(
    @CurrentUser('id') userId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query('before') before?: string,
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe()) limit = 50,
  ) {
    const capped = Math.min(Math.max(limit, 1), 100);
    return this.chat.listMessages(userId, matchId, before, capped);
  }

  @Post()
  @ApiOperation({
    summary:
      'Send a message (text or image). Image flow: POST /uploads/presign (kind=chat) -> PUT file -> send fileUrl here. Fanout: socket if recipient online, FCM push otherwise.',
  })
  send(
    @CurrentUser('id') userId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.createMessage(userId, matchId, dto);
  }
}

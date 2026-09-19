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
import { CreateGroupDto } from './dto/create-group.dto';
import { RespondGroupDto } from './dto/respond-group.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a group workout (story #11) + invite 1..4 members in one shot. Schedules a T-24h reminder if a future scheduledAt is provided.',
  })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateGroupDto) {
    return this.groups.create(userId, { title: dto.title, scheduledAt: dto.scheduledAt, inviteeIds: dto.inviteeIds });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Group view: members + attendance states. Visible to the creator and CONFIRMED members.' })
  get(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.get(id, userId);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Invitee accepts or declines a group invite.' })
  respond(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondGroupDto,
  ) {
    return this.groups.respond(id, userId, dto.action);
  }

  @Get(':id/messages')
  @ApiQuery({ name: 'before', required: false })
  @ApiQuery({ name: 'limit', required: false, schema: { default: 50, maximum: 100 } })
  @ApiOperation({ summary: 'Group chat history (story #11), newest page first. Visible to the creator and members.' })
  listMessages(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe()) limit = 50,
  ) {
    const capped = Math.min(Math.max(limit, 1), 100);
    return this.groups.listMessages(id, userId, before, capped);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a text or image message to the group chat. Fanout: socket if recipient online, FCM push otherwise.' })
  send(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendGroupMessageDto,
  ) {
    return this.groups.sendMessage(id, userId, dto);
  }
}

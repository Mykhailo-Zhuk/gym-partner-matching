import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQuery } from '../common/pagination';
import { AdminService } from './admin.service';

class AdminUsersQuery extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Search by email or name (case-insensitive, partial)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class BlockUserDto {
  @ApiProperty({ example: 'Недоречні повідомлення', description: 'Mandatory moderation reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class AuditLogQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;
}

/**
 * Separate admin surface: requires an ADMIN role JWT (role claim, no shared mobile session
 * privileges). Mobile users get 403 even with a valid user token.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Search users by email/name with filters + report counts (paginated)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  listUsers(@Query() query: AdminUsersQuery) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Full user card: profile, reports (received/filed, dated), match history, status' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getUserCard(id);
  }

  @Post('users/:id/block')
  @ApiOperation({
    summary: 'Block user: revokes access instantly, pushes the user, notifies all active matches',
  })
  block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockUserDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.admin.blockUser(id, dto.reason, adminId);
  }

  @Post('users/:id/unblock')
  @ApiOperation({ summary: 'Unblock user: restores access and pushes “Ваш акаунт розблоковано”' })
  unblock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') adminId: string) {
    return this.admin.unblockUser(id, adminId);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Audit trail of admin actions (who, when, reason)' })
  auditLog(@Query() query: AuditLogQuery) {
    return this.admin.listAuditLog(query);
  }
}

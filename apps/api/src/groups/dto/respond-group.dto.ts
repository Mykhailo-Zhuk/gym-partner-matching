import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export const GroupResponse = {
  ACCEPT: 'ACCEPT',
  DECLINE: 'DECLINE',
} as const;

export type GroupResponseAction = (typeof GroupResponse)[keyof typeof GroupResponse];

export class RespondGroupDto {
  @ApiProperty({ enum: GroupResponse, example: GroupResponse.ACCEPT })
  @IsEnum(GroupResponse)
  action!: GroupResponseAction;
}

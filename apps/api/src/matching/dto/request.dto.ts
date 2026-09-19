import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ description: 'ID of the user to send a match request to' })
  @IsNotEmpty()
  @IsUUID()
  to_user_id: string;
}

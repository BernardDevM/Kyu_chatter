import { IsUUID } from 'class-validator';

/**
 * URL parameter representing a room UUID.
 */
export class RoomIdParamDto {
  /** Room UUID */
  @IsUUID('all')
  roomId!: string;
}

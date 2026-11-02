import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';
import { trimString } from './trim-string.js';

/**
 * URL parameters representing a room member relationship (roomId + userId).
 */
export class RoomMemberParamDto {
  /** Room UUID */
  @IsUUID('all')
  roomId!: string;

  /** Member user identifier (1-64 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Transform(trimString)
  userId!: string;
}

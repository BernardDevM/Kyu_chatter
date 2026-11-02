import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload for creating a new group conversation room.
 */
export class CreateGroupRoomDto {
  /** Name of the group room (1-80 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 80)
  @Transform(trimString)
  name!: string;

  /** Optional group topic or description (max 500 characters) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;

  /** Optional group avatar image URL (max 2048 characters) */
  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(2048)
  @Transform(trimString)
  image?: string;

  /** Initial user IDs to add as room members (1-100 members, unique) */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  memberIds!: string[];
}

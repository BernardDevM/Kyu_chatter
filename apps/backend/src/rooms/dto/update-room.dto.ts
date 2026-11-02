import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload for updating room details (owner/admin only).
 * Requires at least one field (name, description, or image) to be provided.
 */
export class UpdateRoomDto {
  /** Updated room name (1-80 characters) */
  @ValidateIf((o: UpdateRoomDto) => (!o.description && !o.image) || o.name !== undefined)
  @IsNotEmpty({ message: 'At least one of [name, description, image] must be provided' })
  @IsString()
  @Length(1, 80)
  @Transform(trimString)
  name?: string;

  /** Updated room description (max 500 characters) */
  @ValidateIf((o: UpdateRoomDto) => o.description !== undefined)
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;

  /** Updated room avatar URL (max 2048 characters) */
  @ValidateIf((o: UpdateRoomDto) => o.image !== undefined)
  @IsString()
  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @MaxLength(2048)
  @Transform(trimString)
  image?: string;
}

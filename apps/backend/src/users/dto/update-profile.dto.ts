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
 * Payload for updating the authenticated user's profile.
 * Requires at least one field (name or image) to be provided.
 */
export class UpdateProfileDto {
  /** User display name (1-80 characters) */
  @ValidateIf((o: UpdateProfileDto) => !o.image || o.name !== undefined)
  @IsNotEmpty({ message: 'At least one field (name or image) must be provided' })
  @IsString()
  @Length(1, 80)
  @Transform(trimString)
  name?: string;

  /** Secure HTTPS avatar image URL (max 2048 characters) */
  @ValidateIf((o: UpdateProfileDto) => !o.name || o.image !== undefined)
  @IsNotEmpty({ message: 'At least one field (name or image) must be provided' })
  @IsString()
  @IsUrl({ protocols: ['https'], require_tld: false })
  @MaxLength(2048)
  @Transform(trimString)
  image?: string;
}

import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload confirming a completed direct upload (docs/API.md §7.2).
 */
export class ConfirmUploadDto {
  /** Media UUID returned by the signature request */
  @IsUUID('all')
  mediaId!: string;

  /** Storage key (Cloudinary public ID) returned by the signature request (1-512 chars) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 512)
  @Transform(trimString)
  storageKey!: string;

  /** Final secure HTTPS URL of the uploaded asset */
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_tld: false })
  @Transform(trimString)
  url!: string;

  /** Optional width in pixels (for images/videos) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  /** Optional height in pixels (for images/videos) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  /** Optional duration in whole seconds (for audio/video) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;
}

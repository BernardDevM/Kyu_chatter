import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Payload confirming a completed direct upload to Cloudinary.
 */
export class ConfirmUploadDto {
  /** Cloudinary storage public ID */
  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  publicId!: string;

  /** Final secure HTTPS URL of the asset */
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_tld: false })
  @Transform(trimString)
  url!: string;

  /** Total uploaded file size in bytes */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bytes!: number;

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

  /** Optional duration in seconds (for audio/video) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duration?: number;
}

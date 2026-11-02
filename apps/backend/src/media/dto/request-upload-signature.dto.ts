import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';
import { AttachmentKind } from '../../generated/prisma/enums.js';
import {
  ALLOWED_MIME_TYPES_REGEX,
  MAX_UPLOAD_BYTES,
} from '../media.constants.js';

/**
 * Payload requesting signed upload parameters for direct client upload to Cloudinary.
 */
export class RequestUploadSignatureDto {
  /** Original filename of the upload asset (1-255 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @Transform(trimString)
  originalName!: string;

  /** MIME type verified against the allowable media allow-list */
  @IsString()
  @IsNotEmpty()
  @Matches(ALLOWED_MIME_TYPES_REGEX, {
    message:
      'mimeType must be an allowed format: image/*, video/*, audio/*, or application/pdf',
  })
  @Transform(trimString)
  mimeType!: string;

  /** Total file size in bytes (1 to 25 MB) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  bytes!: number;

  /** Logical kind of media attachment */
  @IsEnum(AttachmentKind)
  kind!: AttachmentKind;

  /** Optional room UUID the upload will be associated with */
  @IsOptional()
  @IsUUID('all')
  roomId?: string;
}

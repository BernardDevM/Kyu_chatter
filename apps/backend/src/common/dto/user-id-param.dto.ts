import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { trimString } from './trim-string.js';

/**
 * URL parameter representing a user identifier.
 */
export class UserIdParamDto {
  /** User string identifier (1-64 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Transform(trimString)
  id!: string;
}

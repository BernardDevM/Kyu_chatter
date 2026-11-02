import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { trimString } from '../../common/dto/trim-string.js';

/**
 * Query parameters for searching users by name or username prefix.
 */
export class SearchUsersQueryDto {
  /** Search query term (2-64 characters) */
  @IsString()
  @IsNotEmpty()
  @Length(2, 64)
  @Transform(trimString)
  q!: string;

  /** Maximum number of users to return (1-20, defaults to 10) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}

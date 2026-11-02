import { Transform, type TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, Length } from 'class-validator';

/**
 * Query parameters for fetching bulk user presence statuses.
 * Accepts a comma-separated list of user identifiers.
 */
export class PresenceQueryDto {
  /** Array of user IDs parsed from a comma-separated query string (1-100 items, each 1-64 chars) */
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  userIds!: string[];
}

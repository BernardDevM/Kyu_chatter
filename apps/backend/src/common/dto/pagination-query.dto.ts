import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Standard cursor-based pagination query parameters.
 */
export class PaginationQueryDto {
  /** Optional UUID cursor representing the last seen item */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsUUID('all')
  cursor?: string;

  /** Maximum number of records to return (1-100, defaults to 30) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

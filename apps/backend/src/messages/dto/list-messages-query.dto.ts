import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

/**
 * Query parameters for fetching paginated room message history (newest first).
 */
export class ListMessagesQueryDto extends PaginationQueryDto {
  /** Optional pagination direction ('before' or 'after', defaults to 'before') */
  @IsOptional()
  @IsString()
  direction?: 'before' | 'after';
}

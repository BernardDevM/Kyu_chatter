import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

/**
 * Query parameters for fetching paginated room message history.
 */
export class ListMessagesQueryDto extends PaginationQueryDto {
  /** Pagination direction relative to the cursor ('before' or 'after', defaults to 'before') */
  @IsOptional()
  @IsIn(['before', 'after'])
  direction?: 'before' | 'after' = 'before';
}

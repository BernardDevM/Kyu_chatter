import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

/**
 * Query parameters for fetching paginated room message history (newest first).
 */
export class ListMessagesQueryDto extends PaginationQueryDto {}

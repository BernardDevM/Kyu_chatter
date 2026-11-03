import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { RoomType } from '../../generated/prisma/enums.js';

/**
 * Query filters for listing rooms belonging to the authenticated user.
 */
export class ListRoomsQueryDto extends PaginationQueryDto {
  /** Optional filter for archived rooms (parsed from boolean string 'true' or 'false') */
  @IsOptional()
  @Transform(({ value }: TransformFnParams) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isArchived?: boolean;

  /** Optional filter by room type (GROUP or DIRECT) */
  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;
}

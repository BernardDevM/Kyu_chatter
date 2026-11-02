import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, Length } from 'class-validator';

/**
 * Payload for adding members to an existing group room.
 */
export class AddMembersDto {
  /** Array of user identifiers to add (1-100 items, unique) */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  userIds!: string[];
}

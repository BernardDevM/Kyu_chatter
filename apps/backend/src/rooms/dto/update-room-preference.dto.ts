import { IsBoolean, IsNotEmpty, ValidateIf } from 'class-validator';

/**
 * Payload for updating user-specific preferences for a room.
 * Requires at least one setting (isMuted, isArchived, or isPinned) to be provided.
 */
export class UpdateRoomPreferenceDto {
  /** Whether notifications are muted for this room */
  @ValidateIf(
    (o: UpdateRoomPreferenceDto) =>
      (o.isArchived === undefined && o.isPinned === undefined) ||
      o.isMuted !== undefined,
  )
  @IsNotEmpty({
    message: 'At least one of [isMuted, isArchived, isPinned] must be provided',
  })
  @IsBoolean()
  isMuted?: boolean;

  /** Whether the room is archived in the user's room list */
  @ValidateIf((o: UpdateRoomPreferenceDto) => o.isArchived !== undefined)
  @IsBoolean()
  isArchived?: boolean;

  /** Whether the room is pinned to the top of the user's room list */
  @ValidateIf((o: UpdateRoomPreferenceDto) => o.isPinned !== undefined)
  @IsBoolean()
  isPinned?: boolean;
}

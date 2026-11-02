import { IsUUID } from 'class-validator';

/**
 * Payload for marking a room read up to a specific message ID.
 */
export class MarkReadDto {
  /** Target message UUID marking the read cursor */
  @IsUUID('all')
  messageId!: string;
}

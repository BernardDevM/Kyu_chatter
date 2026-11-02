import { IsUUID } from 'class-validator';

/**
 * URL parameter representing a message UUID.
 */
export class MessageIdParamDto {
  /** Message UUID */
  @IsUUID('all')
  messageId!: string;
}

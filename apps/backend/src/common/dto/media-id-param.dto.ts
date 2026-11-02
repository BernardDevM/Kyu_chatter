import { IsUUID } from 'class-validator';

/**
 * URL parameter representing a media UUID.
 */
export class MediaIdParamDto {
  /** Media UUID */
  @IsUUID('all')
  mediaId!: string;
}

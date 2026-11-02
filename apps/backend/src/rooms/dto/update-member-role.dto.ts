import { IsIn } from 'class-validator';
import { MemberRole } from '../../generated/prisma/enums.js';

/**
 * Payload for changing a room member's role within a group room.
 */
export class UpdateMemberRoleDto {
  /** Target role (ADMIN or MEMBER) */
  @IsIn([MemberRole.ADMIN, MemberRole.MEMBER], {
    message: 'role must be either ADMIN or MEMBER',
  })
  role!: typeof MemberRole.ADMIN | typeof MemberRole.MEMBER;
}

import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

/**
 * Re-export AllowAnonymous as Public to mark routes that skip authentication.
 */
export const Public = AllowAnonymous;

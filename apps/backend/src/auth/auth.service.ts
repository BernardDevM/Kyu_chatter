
import { Injectable } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@Injectable()
export class AuthService {
  getCurrentUser(session: UserSession) {
    const {
      id,
      name,
      email,
      image,
      emailVerified,
    } = session.user;

    return {
      authenticated: true,
      user: {
        id,
        name,
        email,
        image,
        emailVerified,
      },
    };
  }
}

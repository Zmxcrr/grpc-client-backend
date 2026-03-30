import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  USER = 'USER',
  PREMIUM = 'PREMIUM',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

registerEnumType(UserRole, { name: 'UserRole' });

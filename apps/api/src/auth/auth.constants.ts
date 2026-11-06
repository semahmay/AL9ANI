import type { UserRole } from '../generated/prisma/enums';

export const ACCESS_TOKEN_ISSUER = 'al9ani-api';
export const ACCESS_TOKEN_AUDIENCE = 'al9ani-clients';
export const REFRESH_COOKIE_PATH = '/api/auth';
export const AUTH_CLIENTS = ['web', 'mobile'] as const;

export const PUBLIC_ROUTE_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';

export const ROLE_VALUES: UserRole[] = ['CUSTOMER', 'OWNER', 'ADMIN'];

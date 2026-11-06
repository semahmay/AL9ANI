import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { AUTH_CLIENTS } from '../auth.constants';
import type { AuthClient } from '../auth.types';
import { UserRole } from '../../generated/prisma/enums';

const PUBLIC_REGISTRATION_ROLES = [UserRole.CUSTOMER, UserRole.OWNER] as const;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RegisterDto {
  @ApiProperty({ example: 'amina@example.com', format: 'email', maxLength: 320 })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiProperty({ example: 'Amina', maxLength: 100 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'Ben Ali', maxLength: 100 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional({ example: '+216 20 123 456', maxLength: 32 })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({
    enum: PUBLIC_REGISTRATION_ROLES,
    default: UserRole.CUSTOMER,
    description: 'Only CUSTOMER and OWNER can be registered publicly.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim().toUpperCase() as UserRole) : value,
  )
  @IsOptional()
  @IsIn(PUBLIC_REGISTRATION_ROLES, {
    message: 'role must be either CUSTOMER or OWNER',
  })
  role?: (typeof PUBLIC_REGISTRATION_ROLES)[number];

  @ApiPropertyOptional({
    enum: AUTH_CLIENTS,
    default: 'web',
    description: 'Web receives an HttpOnly refresh cookie; mobile receives a refresh token.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim().toLowerCase() as AuthClient) : value,
  )
  @IsOptional()
  @IsIn(AUTH_CLIENTS)
  client?: AuthClient;
}

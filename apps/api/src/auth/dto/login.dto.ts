import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { AUTH_CLIENTS } from '../auth.constants';
import type { AuthClient } from '../auth.types';

export class LoginDto {
  @ApiProperty({ example: 'amina@example.com', format: 'email', maxLength: 320 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ enum: AUTH_CLIENTS, default: 'web' })
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim().toLowerCase() as AuthClient) : value,
  )
  @IsOptional()
  @IsIn(AUTH_CLIENTS)
  client?: AuthClient;
}

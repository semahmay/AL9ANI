import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Mobile clients only. Web clients should rely on the HttpOnly refresh cookie.',
    minLength: 16,
    maxLength: 512,
  })
  @IsOptional()
  @IsString()
  @Length(16, 512)
  refreshToken?: string;
}

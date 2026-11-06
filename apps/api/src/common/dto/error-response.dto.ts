import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'Unauthorized' })
  error!: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Authentication required.',
  })
  message!: string | string[];

  @ApiProperty({ example: '/api/auth/me' })
  path!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}

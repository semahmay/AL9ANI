import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PaginationMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { TrimOptional, TrimQuery } from '../../common/transformers';

export class CreateUnavailablePeriodDto {
  @ApiProperty({
    format: 'date-time',
    example: '2026-12-24T08:00:00.000Z',
    description: 'UTC instant or ISO timestamp with an explicit offset.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-12-24T18:00:00.000Z' })
  @IsISO8601({ strict: true, strictSeparator: true })
  endsAt!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Omit or send null for an establishment-wide closure.',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255, example: 'Public holiday' })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string | null;
}

export class UpdateUnavailablePeriodDto extends PartialType(CreateUnavailablePeriodDto) {}

export class UnavailablePeriodQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by service-specific closure.' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive reason search.' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
}

export class UnavailablePeriodDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  establishmentId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  serviceId!: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ format: 'date-time' })
  endsAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class UnavailablePeriodPageDto {
  @ApiProperty({ type: [UnavailablePeriodDto] })
  data!: UnavailablePeriodDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { NormalizeCurrency, Trim, TrimOptional, TrimQuery } from '../../common/transformers';
import { BookingType } from '../../generated/prisma/enums';

export class CreateServiceDto {
  @ApiProperty({ example: 'Signature facial', maxLength: 160 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({ enum: BookingType })
  @IsEnum(BookingType)
  bookingType!: BookingType;

  @ApiProperty({
    example: 60,
    minimum: 1,
    maximum: 1440,
    description: 'Duration in minutes.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: 10000,
    description: 'Required to be at least 2 for CLASS services and exactly 1 for APPOINTMENT.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  capacity?: number;

  @ApiProperty({ example: 75.5, minimum: 0.001, maximum: 9999999.999 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(9999999.999)
  price!: number;

  @ApiPropertyOptional({
    default: 'TND',
    example: 'TND',
    description: 'ISO 4217 three-letter currency code.',
    pattern: '^[A-Z]{3}$',
  })
  @NormalizeCurrency()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class ServiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active state.' })
  @Transform(({ value }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Case-insensitive service name or description search.' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class PublicServiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive service name or description search.' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 'Tunis' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'pilates-and-yoga' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  establishmentId?: string;

  @ApiPropertyOptional({ example: 'lotus-beauty-studio' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  establishmentSlug?: string;
}

export class ServiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  establishmentId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: BookingType })
  bookingType!: BookingType;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  capacity!: number;

  @ApiProperty({ example: '75.500', description: 'Decimal price serialized as a string.' })
  price!: string;

  @ApiProperty({ example: 'TND' })
  currency!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class PublicServiceEstablishmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  timezone!: string;
}

export class PublicServiceDto extends ServiceDto {
  @ApiProperty({ type: PublicServiceEstablishmentDto })
  establishment!: PublicServiceEstablishmentDto;
}

export class ServicePageDto {
  @ApiProperty({ type: [ServiceDto] })
  data!: ServiceDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class PublicServicePageDto {
  @ApiProperty({ type: [PublicServiceDto] })
  data!: PublicServiceDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

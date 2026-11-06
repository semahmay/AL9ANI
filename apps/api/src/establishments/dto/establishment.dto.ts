import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  NormalizeCountry,
  NormalizeSlug,
  Trim,
  TrimOptional,
  TrimQuery,
} from '../../common/transformers';
import { IsIanaTimeZone } from '../../common/validators/is-iana-timezone.validator';
import { EstablishmentStatus } from '../../generated/prisma/enums';

export class EstablishmentWritableFieldsDto {
  @ApiProperty({ example: 'Lotus Beauty Studio', maxLength: 160 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ example: '+216 71 123 456', nullable: true, maxLength: 32 })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ format: 'email', nullable: true, maxLength: 320 })
  @TrimOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true, maxLength: 500 })
  @TrimOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine?: string | null;

  @ApiProperty({ example: 'Tunis', maxLength: 120 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional({
    default: 'TN',
    description: 'ISO 3166-1 alpha-2 country code.',
    pattern: '^[A-Z]{2}$',
  })
  @NormalizeCountry()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90, example: 36.8065 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, example: 10.1815 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiPropertyOptional({
    default: 'Africa/Tunis',
    example: 'Africa/Tunis',
    description: 'IANA time zone used for local business hours.',
    maxLength: 64,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIanaTimeZone()
  timezone?: string;
}

export class CreateEstablishmentDto extends EstablishmentWritableFieldsDto {
  @ApiPropertyOptional({
    example: 'lotus-beauty-studio',
    description: 'Public URL identifier. Generated from the name when omitted.',
    maxLength: 180,
  })
  @NormalizeSlug()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain only lowercase letters, numbers, and single hyphens.',
  })
  slug?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Existing active category IDs to assign immediately.',
    maxItems: 20,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}

export class UpdateEstablishmentDto extends PartialType(EstablishmentWritableFieldsDto) {}

export class AssignCategoriesDto {
  @ApiProperty({
    type: [String],
    description: 'Replaces the establishment category list. Use an empty array to remove all.',
    maxItems: 20,
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  categoryIds!: string[];
}

export class EstablishmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EstablishmentStatus })
  @IsOptional()
  @IsEnum(EstablishmentStatus)
  status?: EstablishmentStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive name, city, or slug search.' })
  @TrimQuery()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AdminEstablishmentQueryDto extends EstablishmentQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by owner user ID.' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class PublicEstablishmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive name, city, or description search.' })
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
}

export class ModerationReasonDto {
  @ApiProperty({ maxLength: 500, example: 'The business address needs verification.' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class RejectEstablishmentDto extends ModerationReasonDto {}
export class SuspendEstablishmentDto extends ModerationReasonDto {}

export class EstablishmentCategorySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  isActive!: boolean;
}

export class EstablishmentBaseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine!: string | null;

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  governorate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode!: string | null;

  @ApiProperty()
  country!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 36.8065 })
  latitude!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 10.1815 })
  longitude!: number | null;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ type: [EstablishmentCategorySummaryDto] })
  categories!: EstablishmentCategorySummaryDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class OwnerEstablishmentDto extends EstablishmentBaseDto {
  @ApiProperty({ format: 'uuid' })
  ownerId!: string;

  @ApiProperty({ enum: EstablishmentStatus })
  status!: EstablishmentStatus;

  @ApiPropertyOptional({ nullable: true })
  statusReason!: string | null;
}

export class EstablishmentOwnerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;
}

export class AdminEstablishmentDto extends OwnerEstablishmentDto {
  @ApiProperty({ type: EstablishmentOwnerSummaryDto })
  owner!: EstablishmentOwnerSummaryDto;
}

export class EstablishmentStatusDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: EstablishmentStatus })
  status!: EstablishmentStatus;

  @ApiPropertyOptional({ nullable: true })
  statusReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class OwnerEstablishmentPageDto {
  @ApiProperty({ type: [OwnerEstablishmentDto] })
  data!: OwnerEstablishmentDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class AdminEstablishmentPageDto {
  @ApiProperty({ type: [AdminEstablishmentDto] })
  data!: AdminEstablishmentDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class PublicEstablishmentPageDto {
  @ApiProperty({ type: [EstablishmentBaseDto] })
  data!: EstablishmentBaseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

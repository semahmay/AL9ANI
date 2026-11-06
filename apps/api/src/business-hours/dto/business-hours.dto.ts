import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

import { DayOfWeek } from '../../generated/prisma/enums';

export class CreateBusinessHoursDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({
    example: 540,
    minimum: 0,
    maximum: 1439,
    description: 'Local wall-clock minutes since midnight in the establishment time zone.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  opensAtMinute!: number;

  @ApiProperty({
    example: 720,
    minimum: 1,
    maximum: 1440,
    description: 'Local wall-clock minutes since midnight; 1440 is the end of day.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  closesAtMinute!: number;
}

export class UpdateBusinessHoursDto extends PartialType(CreateBusinessHoursDto) {}

export class BusinessHoursDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  establishmentId!: string;

  @ApiProperty({ enum: DayOfWeek })
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ example: 540 })
  opensAtMinute!: number;

  @ApiProperty({ example: 720 })
  closesAtMinute!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class BusinessHoursListDto {
  @ApiProperty({ format: 'uuid' })
  establishmentId!: string;

  @ApiProperty({
    example: 'Africa/Tunis',
    description: 'IANA time zone that gives meaning to the local minute values.',
  })
  timezone!: string;

  @ApiProperty({ type: [BusinessHoursDto] })
  intervals!: BusinessHoursDto[];
}

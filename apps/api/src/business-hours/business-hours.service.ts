import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { EstablishmentsService } from '../establishments/establishments.service';
import { Prisma } from '../generated/prisma/client';
import type { BusinessHours } from '../generated/prisma/client';
import type { DayOfWeek } from '../generated/prisma/enums';
import type {
  BusinessHoursDto,
  BusinessHoursListDto,
  CreateBusinessHoursDto,
  UpdateBusinessHoursDto,
} from './dto/business-hours.dto';

@Injectable()
export class BusinessHoursService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EstablishmentsService) private readonly establishmentsService: EstablishmentsService,
  ) {}

  async list(establishmentId: string, ownerId: string): Promise<BusinessHoursListDto> {
    const establishment = await this.establishmentsService.assertOwned(establishmentId, ownerId);
    const intervals = await this.prisma.businessHours.findMany({
      where: { establishmentId },
      orderBy: [{ dayOfWeek: 'asc' }, { opensAtMinute: 'asc' }],
    });

    return {
      establishmentId,
      timezone: establishment.timezone,
      intervals: intervals.map((interval) => this.toDto(interval)),
    };
  }

  async create(
    establishmentId: string,
    ownerId: string,
    dto: CreateBusinessHoursDto,
  ): Promise<BusinessHoursDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    this.assertRange(dto.opensAtMinute, dto.closesAtMinute);
    await this.assertNoOverlap(
      establishmentId,
      dto.dayOfWeek,
      dto.opensAtMinute,
      dto.closesAtMinute,
    );

    try {
      const interval = await this.prisma.businessHours.create({
        data: {
          establishmentId,
          dayOfWeek: dto.dayOfWeek,
          opensAtMinute: dto.opensAtMinute,
          closesAtMinute: dto.closesAtMinute,
        },
      });

      return this.toDto(interval);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    establishmentId: string,
    hoursId: string,
    ownerId: string,
    dto: UpdateBusinessHoursDto,
  ): Promise<BusinessHoursDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    const current = await this.getOwnedRecord(establishmentId, hoursId);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one business-hours field to update.');
    }

    const dayOfWeek = dto.dayOfWeek ?? current.dayOfWeek;
    const opensAtMinute = dto.opensAtMinute ?? current.opensAtMinute;
    const closesAtMinute = dto.closesAtMinute ?? current.closesAtMinute;

    this.assertRange(opensAtMinute, closesAtMinute);
    await this.assertNoOverlap(establishmentId, dayOfWeek, opensAtMinute, closesAtMinute, hoursId);

    try {
      const interval = await this.prisma.businessHours.update({
        where: { id: hoursId },
        data: {
          dayOfWeek,
          opensAtMinute,
          closesAtMinute,
        },
      });

      return this.toDto(interval);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async delete(
    establishmentId: string,
    hoursId: string,
    ownerId: string,
  ): Promise<{ success: true }> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    await this.getOwnedRecord(establishmentId, hoursId);
    await this.prisma.businessHours.delete({ where: { id: hoursId } });
    return { success: true };
  }

  private async getOwnedRecord(establishmentId: string, hoursId: string): Promise<BusinessHours> {
    const interval = await this.prisma.businessHours.findFirst({
      where: {
        id: hoursId,
        establishmentId,
      },
    });

    if (!interval) {
      throw new NotFoundException('Business-hours interval not found.');
    }

    return interval;
  }

  private assertRange(opensAtMinute: number, closesAtMinute: number): void {
    if (
      !Number.isInteger(opensAtMinute) ||
      !Number.isInteger(closesAtMinute) ||
      opensAtMinute < 0 ||
      closesAtMinute > 1440 ||
      opensAtMinute >= closesAtMinute
    ) {
      throw new BadRequestException(
        'Business hours must satisfy 0 <= opensAtMinute < closesAtMinute <= 1440.',
      );
    }
  }

  private async assertNoOverlap(
    establishmentId: string,
    dayOfWeek: DayOfWeek,
    opensAtMinute: number,
    closesAtMinute: number,
    excludeId?: string,
  ): Promise<void> {
    const intervals = await this.prisma.businessHours.findMany({
      where: {
        establishmentId,
        dayOfWeek,
        ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
      },
      select: {
        opensAtMinute: true,
        closesAtMinute: true,
      },
    });

    const overlaps = intervals.some(
      (interval) =>
        opensAtMinute < interval.closesAtMinute && interval.opensAtMinute < closesAtMinute,
    );

    if (overlaps) {
      throw new BadRequestException(
        'Business-hours intervals for the same weekday must not overlap.',
      );
    }
  }

  private toDto(interval: BusinessHours): BusinessHoursDto {
    return {
      id: interval.id,
      establishmentId: interval.establishmentId,
      dayOfWeek: interval.dayOfWeek,
      opensAtMinute: interval.opensAtMinute,
      closesAtMinute: interval.closesAtMinute,
      createdAt: interval.createdAt,
      updatedAt: interval.updatedAt,
    };
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('This business-hours interval already exists.');
    }
  }
}

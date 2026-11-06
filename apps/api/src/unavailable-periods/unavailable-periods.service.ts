import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { paginationArgs, paginationMeta } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { EstablishmentsService } from '../establishments/establishments.service';
import { Prisma } from '../generated/prisma/client';
import type { UnavailablePeriod } from '../generated/prisma/client';
import type {
  CreateUnavailablePeriodDto,
  UnavailablePeriodDto,
  UnavailablePeriodPageDto,
  UnavailablePeriodQueryDto,
  UpdateUnavailablePeriodDto,
} from './dto/unavailable-period.dto';

@Injectable()
export class UnavailablePeriodsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EstablishmentsService) private readonly establishmentsService: EstablishmentsService,
  ) {}

  async list(
    establishmentId: string,
    ownerId: string,
    query: UnavailablePeriodQueryDto,
  ): Promise<UnavailablePeriodPageDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);

    const where: Prisma.UnavailablePeriodWhereInput = {
      establishmentId,
      ...(query.serviceId !== undefined ? { serviceId: query.serviceId } : {}),
      ...(query.q !== undefined ? { reason: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [total, periods] = await this.prisma.$transaction([
      this.prisma.unavailablePeriod.count({ where }),
      this.prisma.unavailablePeriod.findMany({
        where,
        orderBy: [{ startsAt: 'asc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: periods.map((period) => this.toDto(period)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async create(
    establishmentId: string,
    ownerId: string,
    dto: CreateUnavailablePeriodDto,
  ): Promise<UnavailablePeriodDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    const startsAt = this.parseDate(dto.startsAt, 'startsAt');
    const endsAt = this.parseDate(dto.endsAt, 'endsAt');
    this.assertRange(startsAt, endsAt);
    await this.assertServiceBelongsToEstablishment(establishmentId, dto.serviceId ?? null);

    const period = await this.prisma.unavailablePeriod.create({
      data: {
        establishmentId,
        serviceId: dto.serviceId ?? null,
        startsAt,
        endsAt,
        reason: dto.reason ?? null,
      },
    });

    return this.toDto(period);
  }

  async update(
    establishmentId: string,
    periodId: string,
    ownerId: string,
    dto: UpdateUnavailablePeriodDto,
  ): Promise<UnavailablePeriodDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    const current = await this.getOwnedRecord(establishmentId, periodId);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one unavailable-period field to update.');
    }

    const startsAt =
      dto.startsAt === undefined ? current.startsAt : this.parseDate(dto.startsAt, 'startsAt');
    const endsAt = dto.endsAt === undefined ? current.endsAt : this.parseDate(dto.endsAt, 'endsAt');
    const serviceId = dto.serviceId === undefined ? current.serviceId : dto.serviceId;

    this.assertRange(startsAt, endsAt);
    await this.assertServiceBelongsToEstablishment(establishmentId, serviceId);

    const period = await this.prisma.unavailablePeriod.update({
      where: { id: periodId },
      data: {
        startsAt,
        endsAt,
        serviceId,
        reason: dto.reason,
      },
    });

    return this.toDto(period);
  }

  async delete(
    establishmentId: string,
    periodId: string,
    ownerId: string,
  ): Promise<{ success: true }> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    await this.getOwnedRecord(establishmentId, periodId);
    await this.prisma.unavailablePeriod.delete({ where: { id: periodId } });
    return { success: true };
  }

  private async getOwnedRecord(
    establishmentId: string,
    periodId: string,
  ): Promise<UnavailablePeriod> {
    const period = await this.prisma.unavailablePeriod.findFirst({
      where: {
        id: periodId,
        establishmentId,
      },
    });

    if (!period) {
      throw new NotFoundException('Unavailable period not found.');
    }

    return period;
  }

  private async assertServiceBelongsToEstablishment(
    establishmentId: string,
    serviceId: string | null,
  ): Promise<void> {
    if (serviceId === null) {
      return;
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        establishmentId,
      },
      select: { id: true },
    });

    if (!service) {
      throw new BadRequestException('Service does not belong to this establishment.');
    }
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO 8601 timestamp.`);
    }

    return date;
  }

  private assertRange(startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be later than startsAt.');
    }
  }

  private toDto(period: UnavailablePeriod): UnavailablePeriodDto {
    return {
      id: period.id,
      establishmentId: period.establishmentId,
      serviceId: period.serviceId,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      reason: period.reason,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  }
}

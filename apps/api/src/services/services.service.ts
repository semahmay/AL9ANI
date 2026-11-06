import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginationArgs, paginationMeta } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { EstablishmentsService } from '../establishments/establishments.service';
import { Prisma } from '../generated/prisma/client';
import type { Service } from '../generated/prisma/client';
import { BookingType, EstablishmentStatus } from '../generated/prisma/enums';
import type {
  CreateServiceDto,
  PublicServiceDto,
  PublicServicePageDto,
  PublicServiceQueryDto,
  ServiceDto,
  ServicePageDto,
  ServiceQueryDto,
  UpdateServiceDto,
} from './dto/service.dto';

const publicServiceInclude = {
  establishment: {
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      timezone: true,
    },
  },
} satisfies Prisma.ServiceInclude;

type PublicServiceRecord = Prisma.ServiceGetPayload<{
  include: typeof publicServiceInclude;
}>;

@Injectable()
export class ServicesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EstablishmentsService) private readonly establishmentsService: EstablishmentsService,
  ) {}

  async create(
    establishmentId: string,
    ownerId: string,
    dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    this.assertCapacityForBookingType(dto.bookingType, dto.capacity ?? 1);

    try {
      const service = await this.prisma.service.create({
        data: {
          establishmentId,
          name: dto.name,
          description: dto.description ?? null,
          bookingType: dto.bookingType,
          durationMinutes: dto.durationMinutes,
          capacity: dto.capacity ?? 1,
          price: dto.price,
          currency: dto.currency ?? 'TND',
        },
      });

      return this.toDto(service);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async listOwned(
    establishmentId: string,
    ownerId: string,
    query: ServiceQueryDto,
  ): Promise<ServicePageDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);

    const where: Prisma.ServiceWhereInput = {
      establishmentId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q !== undefined
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: services.map((service) => this.toDto(service)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async getOwned(establishmentId: string, serviceId: string, ownerId: string): Promise<ServiceDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    return this.toDto(await this.getOwnedRecord(establishmentId, serviceId));
  }

  async update(
    establishmentId: string,
    serviceId: string,
    ownerId: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    const current = await this.getOwnedRecord(establishmentId, serviceId);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one service field to update.');
    }

    this.assertCapacityForBookingType(
      dto.bookingType ?? current.bookingType,
      dto.capacity ?? current.capacity,
    );

    try {
      const service = await this.prisma.service.update({
        where: { id: serviceId },
        data: {
          name: dto.name,
          description: dto.description,
          bookingType: dto.bookingType,
          durationMinutes: dto.durationMinutes,
          capacity: dto.capacity,
          price: dto.price,
          currency: dto.currency,
        },
      });

      return this.toDto(service);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async deactivate(
    establishmentId: string,
    serviceId: string,
    ownerId: string,
  ): Promise<ServiceDto> {
    await this.establishmentsService.assertOwned(establishmentId, ownerId);
    await this.getOwnedRecord(establishmentId, serviceId);

    const service = await this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });

    return this.toDto(service);
  }

  async listPublic(query: PublicServiceQueryDto): Promise<PublicServicePageDto> {
    const establishmentFilter: Prisma.EstablishmentWhereInput = {
      status: EstablishmentStatus.ACTIVE,
      owner: { isActive: true },
      ...(query.city !== undefined ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.category !== undefined
        ? {
            categories: {
              some: {
                category: {
                  slug: query.category,
                  isActive: true,
                },
              },
            },
          }
        : {}),
    };

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      establishment: establishmentFilter,
      ...(query.establishmentId !== undefined ? { establishmentId: query.establishmentId } : {}),
      ...(query.establishmentSlug !== undefined
        ? { establishment: { ...establishmentFilter, slug: query.establishmentSlug } }
        : {}),
      ...(query.q !== undefined
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, services] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        include: publicServiceInclude,
        orderBy: [{ createdAt: 'desc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: services.map((service) => this.toPublicDto(service)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async getPublicById(id: string): Promise<PublicServiceDto> {
    const service = await this.prisma.service.findFirst({
      where: {
        id,
        isActive: true,
        establishment: {
          status: EstablishmentStatus.ACTIVE,
          owner: { isActive: true },
        },
      },
      include: publicServiceInclude,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    return this.toPublicDto(service);
  }

  private async getOwnedRecord(establishmentId: string, serviceId: string): Promise<Service> {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        establishmentId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    return service;
  }

  private assertCapacityForBookingType(bookingType: BookingType, capacity: number): void {
    if (bookingType === BookingType.APPOINTMENT && capacity !== 1) {
      throw new BadRequestException('APPOINTMENT services must have a capacity of 1.');
    }

    if (bookingType === BookingType.CLASS && capacity < 2) {
      throw new BadRequestException('CLASS services must have a capacity of at least 2.');
    }

    if (bookingType === BookingType.RESOURCE && capacity < 1) {
      throw new BadRequestException('RESOURCE services must have a capacity of at least 1.');
    }
  }

  private toDto(service: Service): ServiceDto {
    return {
      id: service.id,
      establishmentId: service.establishmentId,
      name: service.name,
      description: service.description,
      bookingType: service.bookingType,
      durationMinutes: service.durationMinutes,
      capacity: service.capacity,
      price: service.price.toFixed(3),
      currency: service.currency,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private toPublicDto(service: PublicServiceRecord): PublicServiceDto {
    return {
      ...this.toDto(service),
      establishment: service.establishment,
    };
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(
        'A service with this name already exists for this establishment.',
      );
    }
  }
}

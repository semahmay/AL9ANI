import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CategoriesService } from '../categories/categories.service';
import { paginationArgs, paginationMeta } from '../common/dto/pagination.dto';
import { slugBase, withNumericSuffix } from '../common/utils/slug';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { EstablishmentStatus } from '../generated/prisma/enums';
import {
  adminEstablishmentInclude,
  establishmentCategoriesInclude,
  mapAdminEstablishment,
  mapEstablishmentBase,
  mapOwnerEstablishment,
  publicEstablishmentInclude,
  type AdminEstablishmentRecord,
  type EstablishmentWithCategories,
} from './establishment.mapper';
import type {
  AdminEstablishmentDto,
  AdminEstablishmentPageDto,
  AdminEstablishmentQueryDto,
  CreateEstablishmentDto,
  EstablishmentBaseDto,
  EstablishmentQueryDto,
  EstablishmentStatusDto,
  OwnerEstablishmentDto,
  OwnerEstablishmentPageDto,
  PublicEstablishmentPageDto,
  PublicEstablishmentQueryDto,
  UpdateEstablishmentDto,
} from './dto/establishment.dto';

export interface OwnedEstablishmentSummary {
  id: string;
  timezone: string;
  status: EstablishmentStatus;
}

@Injectable()
export class EstablishmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CategoriesService) private readonly categoriesService: CategoriesService,
  ) {}

  async create(ownerId: string, dto: CreateEstablishmentDto): Promise<OwnerEstablishmentDto> {
    const categoryIds = dto.categoryIds ?? [];
    await this.categoriesService.assertActiveCategories(categoryIds);

    const latitude = dto.latitude ?? null;
    const longitude = dto.longitude ?? null;
    this.assertCoordinatePair(latitude, longitude);

    const slug = await this.resolveSlug(dto.name, dto.slug);

    try {
      const establishment = await this.prisma.establishment.create({
        data: {
          ownerId,
          name: dto.name,
          slug,
          description: dto.description ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          website: dto.website ?? null,
          addressLine: dto.addressLine ?? null,
          city: dto.city,
          governorate: dto.governorate ?? null,
          postalCode: dto.postalCode ?? null,
          country: dto.country ?? 'TN',
          latitude,
          longitude,
          timezone: dto.timezone ?? 'Africa/Tunis',
          ...(categoryIds.length > 0
            ? {
                categories: {
                  create: categoryIds.map((categoryId) => ({ categoryId })),
                },
              }
            : {}),
        },
        include: establishmentCategoriesInclude,
      });

      return mapOwnerEstablishment(establishment);
    } catch (error) {
      this.rethrowSlugConflict(error);
      throw error;
    }
  }

  async listOwned(
    ownerId: string,
    query: EstablishmentQueryDto,
  ): Promise<OwnerEstablishmentPageDto> {
    const where: Prisma.EstablishmentWhereInput = {
      ownerId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.q !== undefined
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, establishments] = await this.prisma.$transaction([
      this.prisma.establishment.count({ where }),
      this.prisma.establishment.findMany({
        where,
        include: establishmentCategoriesInclude,
        orderBy: [{ createdAt: 'desc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: establishments.map((establishment) => mapOwnerEstablishment(establishment)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async getOwned(id: string, ownerId: string): Promise<OwnerEstablishmentDto> {
    return mapOwnerEstablishment(await this.getOwnedRecord(id, ownerId));
  }

  async getOwnedStatus(id: string, ownerId: string): Promise<EstablishmentStatusDto> {
    const establishment = await this.getOwnedRecord(id, ownerId);
    return this.toStatusDto(establishment);
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateEstablishmentDto,
  ): Promise<OwnerEstablishmentDto> {
    const current = await this.getOwnedRecord(id, ownerId);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one establishment field to update.');
    }

    const latitude =
      dto.latitude === undefined ? (current.latitude?.toNumber() ?? null) : dto.latitude;
    const longitude =
      dto.longitude === undefined ? (current.longitude?.toNumber() ?? null) : dto.longitude;
    this.assertCoordinatePair(latitude, longitude);

    const data: Prisma.EstablishmentUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.addressLine !== undefined) data.addressLine = dto.addressLine;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.governorate !== undefined) data.governorate = dto.governorate;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      data.latitude = latitude;
      data.longitude = longitude;
    }
    if (dto.timezone !== undefined) data.timezone = dto.timezone;

    const establishment = await this.prisma.establishment.update({
      where: { id },
      data,
      include: establishmentCategoriesInclude,
    });

    return mapOwnerEstablishment(establishment);
  }

  async assignCategories(
    id: string,
    ownerId: string,
    categoryIds: string[],
  ): Promise<OwnerEstablishmentDto> {
    await this.getOwnedRecord(id, ownerId);
    await this.categoriesService.assertActiveCategories(categoryIds);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.establishmentCategory.deleteMany({
        where: { establishmentId: id },
      });

      if (categoryIds.length > 0) {
        await transaction.establishmentCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            establishmentId: id,
            categoryId,
          })),
        });
      }
    });

    return this.getOwned(id, ownerId);
  }

  async submit(id: string, ownerId: string): Promise<EstablishmentStatusDto> {
    const establishment = await this.getOwnedRecord(id, ownerId);

    if (
      establishment.status !== EstablishmentStatus.DRAFT &&
      establishment.status !== EstablishmentStatus.REJECTED
    ) {
      throw new ConflictException(
        'Only draft or rejected establishments can be submitted for approval.',
      );
    }

    const activeCategoryCount = await this.prisma.establishmentCategory.count({
      where: {
        establishmentId: id,
        category: { isActive: true },
      },
    });

    if (activeCategoryCount === 0) {
      throw new BadRequestException(
        'Assign at least one active category before submitting for approval.',
      );
    }

    const updated = await this.prisma.establishment.update({
      where: { id },
      data: {
        status: EstablishmentStatus.PENDING,
        statusReason: null,
      },
    });

    return this.toStatusDto(updated);
  }

  async listAdmin(query: AdminEstablishmentQueryDto): Promise<AdminEstablishmentPageDto> {
    const where: Prisma.EstablishmentWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.ownerId !== undefined ? { ownerId: query.ownerId } : {}),
      ...(query.q !== undefined
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
              { owner: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, establishments] = await this.prisma.$transaction([
      this.prisma.establishment.count({ where }),
      this.prisma.establishment.findMany({
        where,
        include: adminEstablishmentInclude,
        orderBy: [{ createdAt: 'desc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: establishments.map((establishment) => mapAdminEstablishment(establishment)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async getAdmin(id: string): Promise<AdminEstablishmentDto> {
    return mapAdminEstablishment(await this.getAdminRecord(id));
  }

  async approve(id: string): Promise<AdminEstablishmentDto> {
    const establishment = await this.getAdminRecord(id);

    if (establishment.status !== EstablishmentStatus.PENDING) {
      throw new ConflictException('Only pending establishments can be approved.');
    }

    const updated = await this.prisma.establishment.update({
      where: { id },
      data: {
        status: EstablishmentStatus.ACTIVE,
        statusReason: null,
      },
      include: adminEstablishmentInclude,
    });

    return mapAdminEstablishment(updated);
  }

  async reject(id: string, reason: string): Promise<AdminEstablishmentDto> {
    const establishment = await this.getAdminRecord(id);

    if (establishment.status !== EstablishmentStatus.PENDING) {
      throw new ConflictException('Only pending establishments can be rejected.');
    }

    const updated = await this.prisma.establishment.update({
      where: { id },
      data: {
        status: EstablishmentStatus.REJECTED,
        statusReason: reason,
      },
      include: adminEstablishmentInclude,
    });

    return mapAdminEstablishment(updated);
  }

  async suspend(id: string, reason: string): Promise<AdminEstablishmentDto> {
    const establishment = await this.getAdminRecord(id);

    if (establishment.status !== EstablishmentStatus.ACTIVE) {
      throw new ConflictException('Only active establishments can be suspended.');
    }

    const updated = await this.prisma.establishment.update({
      where: { id },
      data: {
        status: EstablishmentStatus.SUSPENDED,
        statusReason: reason,
      },
      include: adminEstablishmentInclude,
    });

    return mapAdminEstablishment(updated);
  }

  async listPublic(query: PublicEstablishmentQueryDto): Promise<PublicEstablishmentPageDto> {
    const where: Prisma.EstablishmentWhereInput = {
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
      ...(query.q !== undefined
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, establishments] = await this.prisma.$transaction([
      this.prisma.establishment.count({ where }),
      this.prisma.establishment.findMany({
        where,
        include: publicEstablishmentInclude,
        orderBy: [{ createdAt: 'desc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: establishments.map((establishment) => mapEstablishmentBase(establishment)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  async getPublicBySlug(slug: string): Promise<EstablishmentBaseDto> {
    const establishment = await this.prisma.establishment.findFirst({
      where: {
        slug,
        status: EstablishmentStatus.ACTIVE,
        owner: { isActive: true },
      },
      include: publicEstablishmentInclude,
    });

    if (!establishment) {
      throw new NotFoundException('Establishment not found.');
    }

    return mapEstablishmentBase(establishment);
  }

  /**
   * Used by service, business-hours, and unavailability modules. A missing and
   * another owner's establishment intentionally produce the same 404.
   */
  async assertOwned(establishmentId: string, ownerId: string): Promise<OwnedEstablishmentSummary> {
    const establishment = await this.prisma.establishment.findFirst({
      where: {
        id: establishmentId,
        ownerId,
      },
      select: {
        id: true,
        timezone: true,
        status: true,
      },
    });

    if (!establishment) {
      throw new NotFoundException('Establishment not found.');
    }

    return establishment;
  }

  private async getOwnedRecord(id: string, ownerId: string): Promise<EstablishmentWithCategories> {
    const establishment = await this.prisma.establishment.findFirst({
      where: {
        id,
        ownerId,
      },
      include: establishmentCategoriesInclude,
    });

    if (!establishment) {
      throw new NotFoundException('Establishment not found.');
    }

    return establishment;
  }

  private async getAdminRecord(id: string): Promise<AdminEstablishmentRecord> {
    const establishment = await this.prisma.establishment.findUnique({
      where: { id },
      include: adminEstablishmentInclude,
    });

    if (!establishment) {
      throw new NotFoundException('Establishment not found.');
    }

    return establishment;
  }

  private async resolveSlug(name: string, requestedSlug?: string): Promise<string> {
    if (requestedSlug !== undefined) {
      const existing = await this.prisma.establishment.findUnique({
        where: { slug: requestedSlug },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('An establishment with this slug already exists.');
      }

      return requestedSlug;
    }

    const base = slugBase(name, 'establishment', 180);
    let candidate = base;

    for (let suffix = 2; suffix <= 20; suffix += 1) {
      const existing = await this.prisma.establishment.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      candidate = withNumericSuffix(base, suffix, 180);
    }

    return `${base.slice(0, 168)}-${Date.now().toString(36)}`;
  }

  private assertCoordinatePair(latitude: number | null, longitude: number | null): void {
    if ((latitude === null) !== (longitude === null)) {
      throw new BadRequestException('latitude and longitude must be provided together.');
    }
  }

  private toStatusDto(establishment: {
    id: string;
    status: EstablishmentStatus;
    statusReason: string | null;
    updatedAt: Date;
  }): EstablishmentStatusDto {
    return {
      id: establishment.id,
      status: establishment.status,
      statusReason: establishment.statusReason,
      updatedAt: establishment.updatedAt,
    };
  }

  private rethrowSlugConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('An establishment with this slug already exists.');
    }
  }
}

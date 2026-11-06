import type { Prisma } from '../generated/prisma/client';
import type {
  AdminEstablishmentDto,
  EstablishmentBaseDto,
  EstablishmentCategorySummaryDto,
  OwnerEstablishmentDto,
} from './dto/establishment.dto';

export const establishmentCategoriesInclude = {
  categories: {
    include: {
      category: true,
    },
  },
} satisfies Prisma.EstablishmentInclude;

export const publicEstablishmentInclude = {
  categories: {
    where: {
      category: {
        isActive: true,
      },
    },
    include: {
      category: true,
    },
  },
} satisfies Prisma.EstablishmentInclude;

export const adminEstablishmentInclude = {
  categories: {
    include: {
      category: true,
    },
  },
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.EstablishmentInclude;

export type EstablishmentWithCategories = Prisma.EstablishmentGetPayload<{
  include: typeof establishmentCategoriesInclude;
}>;

export type PublicEstablishmentRecord = Prisma.EstablishmentGetPayload<{
  include: typeof publicEstablishmentInclude;
}>;

export type AdminEstablishmentRecord = Prisma.EstablishmentGetPayload<{
  include: typeof adminEstablishmentInclude;
}>;

function mapCategories(
  categories: EstablishmentWithCategories['categories'],
): EstablishmentCategorySummaryDto[] {
  return categories.map((link) => ({
    id: link.category.id,
    name: link.category.name,
    slug: link.category.slug,
    isActive: link.category.isActive,
  }));
}

export function mapEstablishmentBase(record: PublicEstablishmentRecord): EstablishmentBaseDto {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    phone: record.phone,
    email: record.email,
    website: record.website,
    addressLine: record.addressLine,
    city: record.city,
    governorate: record.governorate,
    postalCode: record.postalCode,
    country: record.country,
    latitude: record.latitude?.toNumber() ?? null,
    longitude: record.longitude?.toNumber() ?? null,
    timezone: record.timezone,
    categories: mapCategories(record.categories),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapOwnerEstablishment(record: EstablishmentWithCategories): OwnerEstablishmentDto {
  return {
    ...mapEstablishmentBase(record),
    ownerId: record.ownerId,
    status: record.status,
    statusReason: record.statusReason,
  };
}

export function mapAdminEstablishment(record: AdminEstablishmentRecord): AdminEstablishmentDto {
  return {
    ...mapOwnerEstablishment(record),
    owner: {
      id: record.owner.id,
      email: record.owner.email,
      firstName: record.owner.firstName,
      lastName: record.owner.lastName,
    },
  };
}

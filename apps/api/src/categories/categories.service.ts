import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  paginationArgs,
  paginationMeta,
  type PaginatedResult,
  type PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { slugBase, withNumericSuffix } from '../common/utils/slug';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Category } from '../generated/prisma/client';
import type {
  CategoryDto,
  CategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublic(query: PaginationQueryDto): Promise<PaginatedResult<CategoryDto>> {
    return this.list(query, true);
  }

  async listAdmin(query: CategoryQueryDto): Promise<PaginatedResult<CategoryDto>> {
    return this.list(query, false, query.isActive);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const slug = await this.resolveSlug(dto.name, dto.slug);

    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description ?? null,
        },
      });

      return this.toDto(category);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.getById(id);

    if (dto.name === undefined && dto.slug === undefined && dto.description === undefined) {
      throw new BadRequestException('Provide at least one category field to update.');
    }

    if (dto.slug !== undefined) {
      const slugOwner = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });

      if (slugOwner && slugOwner.id !== id) {
        throw new ConflictException('A category with this slug already exists.');
      }
    }

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
        },
      });

      return this.toDto(category);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async activate(id: string): Promise<CategoryDto> {
    return this.setActive(id, true);
  }

  async deactivate(id: string): Promise<CategoryDto> {
    return this.setActive(id, false);
  }

  /**
   * Establishment category assignments may only reference existing active
   * categories. The check is intentionally centralised so every write path
   * applies the same rule.
   */
  async assertActiveCategories(categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) {
      return;
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (categories.length !== new Set(categoryIds).size) {
      throw new BadRequestException(
        'One or more categories do not exist or are inactive. Choose active categories only.',
      );
    }
  }

  private async list(
    query: PaginationQueryDto,
    activeOnly: boolean,
    isActive?: boolean,
  ): Promise<PaginatedResult<CategoryDto>> {
    const where: Prisma.CategoryWhereInput = {};

    if (activeOnly) {
      where.isActive = true;
    } else if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [total, categories] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        ...paginationArgs(query.page, query.limit),
      }),
    ]);

    return {
      data: categories.map((category) => this.toDto(category)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  }

  private async getById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return category;
  }

  private async setActive(id: string, isActive: boolean): Promise<CategoryDto> {
    await this.getById(id);

    const category = await this.prisma.category.update({
      where: { id },
      data: { isActive },
    });

    return this.toDto(category);
  }

  private async resolveSlug(name: string, requestedSlug?: string): Promise<string> {
    if (requestedSlug !== undefined) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: requestedSlug },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('A category with this slug already exists.');
      }

      return requestedSlug;
    }

    const base = slugBase(name, 'category', 120);
    let candidate = base;

    for (let suffix = 2; suffix <= 20; suffix += 1) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      candidate = withNumericSuffix(base, suffix, 120);
    }

    return `${base.slice(0, 108)}-${Date.now().toString(36)}`;
  }

  private toDto(category: Category): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A category with this name or slug already exists.');
    }
  }
}

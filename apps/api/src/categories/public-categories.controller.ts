import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CategoriesService } from './categories.service';
import { CategoryPageDto } from './dto/category.dto';

@ApiTags('Public categories')
@Public()
@Controller('categories')
export class PublicCategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List active discovery categories' })
  @ApiOkResponse({ type: CategoryPageDto })
  list(@Query() query: PaginationQueryDto): Promise<CategoryPageDto> {
    return this.categoriesService.listPublic(query);
  }
}

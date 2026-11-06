import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import {
  EstablishmentBaseDto,
  PublicEstablishmentPageDto,
  PublicEstablishmentQueryDto,
} from './dto/establishment.dto';
import { EstablishmentsService } from './establishments.service';

@ApiTags('Establishments (public)')
@Public()
@Controller('public/establishments')
export class PublicEstablishmentsController {
  constructor(
    @Inject(EstablishmentsService) private readonly establishmentsService: EstablishmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Discover approved, active, and publicly eligible establishments' })
  @ApiOkResponse({ type: PublicEstablishmentPageDto })
  list(@Query() query: PublicEstablishmentQueryDto): Promise<PublicEstablishmentPageDto> {
    return this.establishmentsService.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'View one publicly visible establishment by slug' })
  @ApiParam({ name: 'slug', example: 'lotus-beauty-studio' })
  @ApiOkResponse({ type: EstablishmentBaseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(@Param('slug') slug: string): Promise<EstablishmentBaseDto> {
    return this.establishmentsService.getPublicBySlug(slug);
  }
}

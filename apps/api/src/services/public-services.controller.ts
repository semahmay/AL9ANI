import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { PublicServiceDto, PublicServicePageDto, PublicServiceQueryDto } from './dto/service.dto';
import { ServicesService } from './services.service';

@ApiTags('Services (public)')
@Public()
@Controller('public/services')
export class PublicServicesController {
  constructor(@Inject(ServicesService) private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List active services belonging to approved and publicly eligible establishments',
  })
  @ApiOkResponse({ type: PublicServicePageDto })
  list(@Query() query: PublicServiceQueryDto): Promise<PublicServicePageDto> {
    return this.servicesService.listPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'View one publicly visible service' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PublicServiceDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicServiceDto> {
    return this.servicesService.getPublicById(id);
  }
}

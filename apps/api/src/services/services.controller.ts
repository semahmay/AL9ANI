import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { UserRole } from '../generated/prisma/enums';
import {
  CreateServiceDto,
  ServiceDto,
  ServicePageDto,
  ServiceQueryDto,
  UpdateServiceDto,
} from './dto/service.dto';
import { ServicesService } from './services.service';

@ApiTags('Services (owner)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Roles(UserRole.OWNER)
@Controller('establishments/:establishmentId/services')
export class ServicesController {
  constructor(@Inject(ServicesService) private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a service or activity for an owned establishment' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiCreatedResponse({ type: ServiceDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    return this.servicesService.create(establishmentId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List services belonging to an owned establishment' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiOkResponse({ type: ServicePageDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Query() query: ServiceQueryDto,
  ): Promise<ServicePageDto> {
    return this.servicesService.listOwned(establishmentId, user.id, query);
  }

  @Get(':serviceId')
  @ApiOperation({ summary: 'View one service belonging to an owned establishment' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'serviceId', format: 'uuid' })
  @ApiOkResponse({ type: ServiceDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ): Promise<ServiceDto> {
    return this.servicesService.getOwned(establishmentId, serviceId, user.id);
  }

  @Patch(':serviceId')
  @ApiOperation({ summary: 'Update a service without changing its establishment' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'serviceId', format: 'uuid' })
  @ApiOkResponse({ type: ServiceDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceDto> {
    return this.servicesService.update(establishmentId, serviceId, user.id, dto);
  }

  @Post(':serviceId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a service so it is no longer offered' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'serviceId', format: 'uuid' })
  @ApiOkResponse({ type: ServiceDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ): Promise<ServiceDto> {
    return this.servicesService.deactivate(establishmentId, serviceId, user.id);
  }
}

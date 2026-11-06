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
  Put,
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

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { UserRole } from '../generated/prisma/enums';
import {
  AssignCategoriesDto,
  CreateEstablishmentDto,
  EstablishmentQueryDto,
  EstablishmentStatusDto,
  OwnerEstablishmentDto,
  OwnerEstablishmentPageDto,
  UpdateEstablishmentDto,
} from './dto/establishment.dto';
import { EstablishmentsService } from './establishments.service';

@ApiTags('Establishments (owner)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Roles(UserRole.OWNER)
@Controller('establishments')
export class EstablishmentsController {
  constructor(
    @Inject(EstablishmentsService) private readonly establishmentsService: EstablishmentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an establishment owned by the authenticated owner' })
  @ApiCreatedResponse({ type: OwnerEstablishmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEstablishmentDto,
  ): Promise<OwnerEstablishmentDto> {
    return this.establishmentsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List establishments owned by the authenticated owner' })
  @ApiOkResponse({ type: OwnerEstablishmentPageDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EstablishmentQueryDto,
  ): Promise<OwnerEstablishmentPageDto> {
    return this.establishmentsService.listOwned(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'View one of the authenticated owner establishments' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OwnerEstablishmentDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OwnerEstablishmentDto> {
    return this.establishmentsService.getOwned(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update establishment details without changing its status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OwnerEstablishmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEstablishmentDto,
  ): Promise<OwnerEstablishmentDto> {
    return this.establishmentsService.update(id, user.id, dto);
  }

  @Put(':id/categories')
  @ApiOperation({ summary: 'Replace the categories assigned to an owned establishment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OwnerEstablishmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  assignCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignCategoriesDto,
  ): Promise<OwnerEstablishmentDto> {
    return this.establishmentsService.assignCategories(id, user.id, dto.categoryIds);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an establishment for administrator approval' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EstablishmentStatusDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EstablishmentStatusDto> {
    return this.establishmentsService.submit(id, user.id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'View the approval status of an owned establishment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EstablishmentStatusDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EstablishmentStatusDto> {
    return this.establishmentsService.getOwnedStatus(id, user.id);
  }
}

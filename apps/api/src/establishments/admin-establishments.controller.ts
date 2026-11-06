import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { UserRole } from '../generated/prisma/enums';
import {
  AdminEstablishmentDto,
  AdminEstablishmentPageDto,
  AdminEstablishmentQueryDto,
  RejectEstablishmentDto,
  SuspendEstablishmentDto,
} from './dto/establishment.dto';
import { EstablishmentsService } from './establishments.service';

@ApiTags('Establishments (admin)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Roles(UserRole.ADMIN)
@Controller('admin/establishments')
export class AdminEstablishmentsController {
  constructor(
    @Inject(EstablishmentsService) private readonly establishmentsService: EstablishmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List and inspect all establishments' })
  @ApiOkResponse({ type: AdminEstablishmentPageDto })
  list(@Query() query: AdminEstablishmentQueryDto): Promise<AdminEstablishmentPageDto> {
    return this.establishmentsService.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Inspect one establishment and its owner summary' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminEstablishmentDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminEstablishmentDto> {
    return this.establishmentsService.getAdmin(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending establishment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminEstablishmentDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  approve(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminEstablishmentDto> {
    return this.establishmentsService.approve(id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending establishment and record a reason' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminEstablishmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectEstablishmentDto,
  ): Promise<AdminEstablishmentDto> {
    return this.establishmentsService.reject(id, dto.reason);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an active establishment and record a reason' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminEstablishmentDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SuspendEstablishmentDto,
  ): Promise<AdminEstablishmentDto> {
    return this.establishmentsService.suspend(id, dto.reason);
  }
}

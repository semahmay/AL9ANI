import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { SuccessResponseDto } from '../common/dto/success-response.dto';
import { UserRole } from '../generated/prisma/enums';
import { BusinessHoursService } from './business-hours.service';
import {
  BusinessHoursDto,
  BusinessHoursListDto,
  CreateBusinessHoursDto,
  UpdateBusinessHoursDto,
} from './dto/business-hours.dto';

@ApiTags('Business hours (owner)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Roles(UserRole.OWNER)
@Controller('establishments/:establishmentId/business-hours')
export class BusinessHoursController {
  constructor(
    @Inject(BusinessHoursService) private readonly businessHoursService: BusinessHoursService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List recurring business hours in the establishment time zone' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiOkResponse({ type: BusinessHoursListDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
  ): Promise<BusinessHoursListDto> {
    return this.businessHoursService.list(establishmentId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create one recurring opening interval, including split intervals' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiCreatedResponse({ type: BusinessHoursDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Body() dto: CreateBusinessHoursDto,
  ): Promise<BusinessHoursDto> {
    return this.businessHoursService.create(establishmentId, user.id, dto);
  }

  @Patch(':hoursId')
  @ApiOperation({ summary: 'Update one recurring opening interval' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'hoursId', format: 'uuid' })
  @ApiOkResponse({ type: BusinessHoursDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('hoursId', new ParseUUIDPipe()) hoursId: string,
    @Body() dto: UpdateBusinessHoursDto,
  ): Promise<BusinessHoursDto> {
    return this.businessHoursService.update(establishmentId, hoursId, user.id, dto);
  }

  @Delete(':hoursId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete one recurring opening interval' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'hoursId', format: 'uuid' })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('hoursId', new ParseUUIDPipe()) hoursId: string,
  ): Promise<{ success: true }> {
    return this.businessHoursService.delete(establishmentId, hoursId, user.id);
  }
}

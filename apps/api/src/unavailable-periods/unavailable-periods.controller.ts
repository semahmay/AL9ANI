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
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import {
  CreateUnavailablePeriodDto,
  UnavailablePeriodDto,
  UnavailablePeriodPageDto,
  UnavailablePeriodQueryDto,
  UpdateUnavailablePeriodDto,
} from './dto/unavailable-period.dto';
import { UnavailablePeriodsService } from './unavailable-periods.service';

@ApiTags('Unavailable periods (owner)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@Roles(UserRole.OWNER)
@Controller('establishments/:establishmentId/unavailable-periods')
export class UnavailablePeriodsController {
  constructor(
    @Inject(UnavailablePeriodsService)
    private readonly unavailablePeriodsService: UnavailablePeriodsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List establishment-wide and service-specific closures' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiOkResponse({ type: UnavailablePeriodPageDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Query() query: UnavailablePeriodQueryDto,
  ): Promise<UnavailablePeriodPageDto> {
    return this.unavailablePeriodsService.list(establishmentId, user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an establishment-wide or service-specific closure' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiCreatedResponse({ type: UnavailablePeriodDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Body() dto: CreateUnavailablePeriodDto,
  ): Promise<UnavailablePeriodDto> {
    return this.unavailablePeriodsService.create(establishmentId, user.id, dto);
  }

  @Patch(':periodId')
  @ApiOperation({ summary: 'Update an establishment-wide or service-specific closure' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'periodId', format: 'uuid' })
  @ApiOkResponse({ type: UnavailablePeriodDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('periodId', new ParseUUIDPipe()) periodId: string,
    @Body() dto: UpdateUnavailablePeriodDto,
  ): Promise<UnavailablePeriodDto> {
    return this.unavailablePeriodsService.update(establishmentId, periodId, user.id, dto);
  }

  @Delete(':periodId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a closure' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'periodId', format: 'uuid' })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('establishmentId', new ParseUUIDPipe()) establishmentId: string,
    @Param('periodId', new ParseUUIDPipe()) periodId: string,
  ): Promise<{ success: true }> {
    return this.unavailablePeriodsService.delete(establishmentId, periodId, user.id);
  }
}

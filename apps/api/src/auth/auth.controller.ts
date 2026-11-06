import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthService } from './auth.service';
import type { AuthClient, IssuedSession } from './auth.types';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, LogoutResponseDto, SafeUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  type RefreshCookieSettings,
} from './refresh-cookie';

const AUTH_THROTTLE = { limit: 5, ttl: 60_000 };
const SESSION_THROTTLE = { limit: 30, ttl: 60_000 };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: AUTH_THROTTLE })
  @ApiOperation({ summary: 'Register a customer or business owner' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.register(dto);
    return this.completeSession(session, dto.client ?? 'web', response);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: AUTH_THROTTLE })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.login(dto);
    return this.completeSession(session, dto.client ?? 'web', response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: SESSION_THROTTLE })
  @ApiOperation({ summary: 'Rotate a refresh token and issue a new access token' })
  @ApiCookieAuth('al9ani_refresh')
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const cookieToken = readRefreshCookie(request, this.cookieName);
    const token = cookieToken ?? dto.refreshToken;

    if (!token) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const session = await this.authService.refresh(token);

    if (cookieToken) {
      this.setCookie(response, session.refreshToken);
      return this.toResponse(session, false);
    }

    return this.toResponse(session, true);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: SESSION_THROTTLE })
  @ApiOperation({ summary: 'Revoke the current refresh session and clear the cookie' })
  @ApiCookieAuth('al9ani_refresh')
  @ApiBody({ type: LogoutDto, required: false })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async logout(
    @Body() dto: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponseDto> {
    const cookieToken = readRefreshCookie(request, this.cookieName);
    const token = cookieToken ?? dto.refreshToken;

    await this.authService.logout(token);
    clearRefreshCookie(response, this.cookieSettings);

    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiOkResponse({ type: SafeUserDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@CurrentUser() user: { id: string }): Promise<SafeUserDto> {
    return this.authService.getCurrentUser(user.id);
  }

  private completeSession(
    session: IssuedSession,
    client: AuthClient,
    response: Response,
  ): AuthResponseDto {
    if (client === 'mobile') {
      return this.toResponse(session, true);
    }

    this.setCookie(response, session.refreshToken);
    return this.toResponse(session, false);
  }

  private toResponse(session: IssuedSession, includeRefreshToken: boolean): AuthResponseDto {
    return {
      accessToken: session.accessToken,
      tokenType: 'Bearer',
      expiresIn: session.expiresIn,
      user: session.user,
      ...(includeRefreshToken ? { refreshToken: session.refreshToken } : {}),
    };
  }

  private setCookie(response: Response, refreshToken: string): void {
    setRefreshCookie(response, refreshToken, this.cookieSettings);
  }

  private get cookieName(): string {
    return this.configService.getOrThrow<string>('refreshCookieName');
  }

  private get cookieSettings(): RefreshCookieSettings {
    return {
      name: this.cookieName,
      secure: this.configService.getOrThrow<boolean>('refreshCookieSecure'),
      sameSite:
        this.configService.getOrThrow<RefreshCookieSettings['sameSite']>('refreshCookieSameSite'),
      maxAgeMs: this.configService.getOrThrow<number>('refreshTokenTtlSeconds') * 1000,
    };
  }
}

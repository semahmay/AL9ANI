import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { UserRole } from '../generated/prisma/enums';
import type { AccessTokenPayload, IssuedSession, SafeUser } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password';
import { generateRefreshToken, generateSessionFamilyId, hashRefreshToken } from './refresh-token';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth.constants';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

interface SafeUserSource {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class RefreshTokenRaceError extends Error {}

@Injectable()
export class AuthService {
  private dummyPasswordHash?: Promise<string>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession> {
    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone || null,
          role: dto.role ?? UserRole.CUSTOMER,
        },
      });

      return this.issueSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.passwordHash || !user.isActive) {
      // Perform an equivalent verification for unknown/inactive accounts to
      // reduce timing-based account enumeration.
      await verifyPassword(await this.getDummyPasswordHash(), dto.password);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordMatches = await verifyPassword(user.passwordHash, dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    return this.issueSession(user);
  }

  async refresh(rawRefreshToken: string): Promise<IssuedSession> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (session.revokedAt) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token has expired.');
    }

    if (!session.user.isActive) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Account is not active.');
    }

    const now = new Date();
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);
    const expiresAt = this.refreshExpiry(now);

    try {
      await this.prisma.$transaction(async (transaction) => {
        const newSession = await transaction.refreshSession.create({
          data: {
            userId: session.userId,
            familyId: session.familyId,
            tokenHash: newTokenHash,
            expiresAt,
          },
        });

        const revoked = await transaction.refreshSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: {
            revokedAt: now,
            replacedBySessionId: newSession.id,
          },
        });

        if (revoked.count !== 1) {
          throw new RefreshTokenRaceError();
        }
      });
    } catch (error) {
      if (error instanceof RefreshTokenRaceError) {
        // A concurrent or replayed rotation lost the race. Revoke the family so
        // neither branch can keep using a possibly stolen token chain.
        await this.revokeFamily(session.familyId);
        throw new UnauthorizedException('Refresh token has already been used.');
      }

      throw error;
    }

    return {
      accessToken: await this.signAccessToken(session.user.id, session.user.role),
      expiresIn: this.configService.getOrThrow<number>('accessTokenTtlSeconds'),
      refreshToken: newRefreshToken,
      user: this.toSafeUser(session.user),
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });

    if (session) {
      await this.revokeFamily(session.familyId);
    }
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Authentication required.');
    }

    return this.toSafeUser(user);
  }

  private async issueSession(user: SafeUserSource): Promise<IssuedSession> {
    const refreshToken = generateRefreshToken();
    const now = new Date();

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        familyId: generateSessionFamilyId(),
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiry(now),
      },
    });

    return {
      accessToken: await this.signAccessToken(user.id, user.role),
      expiresIn: this.configService.getOrThrow<number>('accessTokenTtlSeconds'),
      refreshToken,
      user: this.toSafeUser(user),
    };
  }

  private signAccessToken(userId: string, role: UserRole): Promise<string> {
    const payload: Pick<AccessTokenPayload, 'sub' | 'role' | 'type'> = {
      sub: userId,
      role,
      type: 'access',
    };

    return this.jwtService.signAsync(payload, {
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });
  }

  private refreshExpiry(from: Date): Date {
    const ttlSeconds = this.configService.getOrThrow<number>('refreshTokenTtlSeconds');
    return new Date(from.getTime() + ttlSeconds * 1000);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= hashPassword('al9ani-dummy-password-for-timing-equalisation');

    return this.dummyPasswordHash;
  }

  private toSafeUser(user: SafeUserSource): SafeUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

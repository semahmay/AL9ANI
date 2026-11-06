import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from '../src/auth/auth.constants';
import { hashPassword } from '../src/auth/password';
import { PrismaService } from '../src/database/prisma.service';
import { UserRole } from '../src/generated/prisma/enums';

process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_DISABLED = 'true';

const TEST_PREFIX = `phase3-${Date.now()}-${randomUUID().slice(0, 8)}`;
const PASSWORD = 'Correct-Horse-Battery-Staple-2026';
const REFRESH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'al9ani_refresh';

interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  server: ReturnType<INestApplication['getHttpServer']>;
}

let context: TestContext;

function emailFor(name: string): string {
  return `${TEST_PREFIX}-${name}@example.com`;
}

function registrationPayload(
  name: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    email: emailFor(name),
    password: PASSWORD,
    firstName: 'Test',
    lastName: name,
    ...overrides,
  };
}

function setCookies(response: {
  headers: Record<string, string | string[] | undefined>;
}): string[] {
  const header = response.headers['set-cookie'];

  if (Array.isArray(header)) {
    return header;
  }

  return header ? [header] : [];
}

function refreshCookieValue(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const cookie = setCookies(response).find((value) => value.startsWith(`${REFRESH_COOKIE_NAME}=`));

  assert.ok(cookie, 'Expected a refresh cookie');
  return cookie.split(';')[0];
}

function expectNoPasswordHash(body: unknown): void {
  assert.equal(
    JSON.stringify(body).includes('passwordHash'),
    false,
    'API response must not contain password hashes',
  );
}

before(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, { enableSwagger: false });
  await app.init();

  context = {
    app,
    prisma: app.get(PrismaService),
    server: app.getHttpServer(),
  };
});

after(async () => {
  if (!context) {
    return;
  }

  await context.prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
  await context.app.close();
});

describe('authentication', () => {
  it('registers a customer and returns safe profile data', async () => {
    const payload = registrationPayload('customer');
    const response = await request(context.server).post('/api/auth/register').send(payload);

    assert.equal(response.status, 201);
    assert.equal(response.body.tokenType, 'Bearer');
    assert.equal(typeof response.body.accessToken, 'string');
    assert.equal(response.body.expiresIn, 900);
    assert.equal(response.body.user.email, payload.email);
    assert.equal(response.body.user.role, UserRole.CUSTOMER);
    assert.equal(response.body.refreshToken, undefined);
    expectNoPasswordHash(response.body);

    const cookies = setCookies(response);
    assert.equal(cookies.length, 1);
    assert.match(cookies[0], new RegExp(`^${REFRESH_COOKIE_NAME}=`));
    assert.match(cookies[0], /HttpOnly/i);
    assert.match(cookies[0], /SameSite=Lax/i);
    assert.match(cookies[0], /Path=\/api\/auth/i);
  });

  it('registers an owner and returns a refresh token for mobile clients', async () => {
    const response = await request(context.server)
      .post('/api/auth/register')
      .send(registrationPayload('owner', { role: UserRole.OWNER, client: 'mobile' }));

    assert.equal(response.status, 201);
    assert.equal(response.body.user.role, UserRole.OWNER);
    assert.equal(typeof response.body.refreshToken, 'string');
    assert.equal(setCookies(response).length, 0);
    expectNoPasswordHash(response.body);
  });

  it('rejects public administrator registration', async () => {
    const email = emailFor('admin-attempt');
    const response = await request(context.server)
      .post('/api/auth/register')
      .send(registrationPayload('admin-attempt', { role: UserRole.ADMIN }));

    assert.equal(response.status, 400);
    assert.match(JSON.stringify(response.body.message), /CUSTOMER or OWNER/);

    const user = await context.prisma.user.findUnique({ where: { email } });
    assert.equal(user, null);
  });

  it('prevents duplicate email registration', async () => {
    const payload = registrationPayload('duplicate');

    const first = await request(context.server).post('/api/auth/register').send(payload);
    assert.equal(first.status, 201);

    const second = await request(context.server).post('/api/auth/register').send(payload);
    assert.equal(second.status, 409);
    assert.equal(second.body.error, 'Conflict');

    const count = await context.prisma.user.count({
      where: { email: payload.email as string },
    });
    assert.equal(count, 1);
  });

  it('returns consistent validation errors for malformed input', async () => {
    const response = await request(context.server).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'short',
      firstName: '',
      lastName: 'User',
      extra: 'not allowed',
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.statusCode, 400);
    assert.equal(response.body.error, 'Bad Request');
    assert.equal(response.body.path, '/api/auth/register');
    assert.ok(Array.isArray(response.body.message));
    assert.ok(response.body.message.length >= 3);
    assert.equal(typeof response.body.timestamp, 'string');
  });

  it('logs in, rejects wrong passwords, and avoids email enumeration', async () => {
    const payload = registrationPayload('login');
    await request(context.server).post('/api/auth/register').send(payload);

    const success = await request(context.server)
      .post('/api/auth/login')
      .send({ email: payload.email, password: PASSWORD });

    assert.equal(success.status, 200);
    assert.equal(typeof success.body.accessToken, 'string');
    assert.equal(success.body.user.email, payload.email);
    expectNoPasswordHash(success.body);

    const wrongPassword = await request(context.server)
      .post('/api/auth/login')
      .send({ email: payload.email, password: 'Wrong-Password-2026!' });

    const unknownEmail = await request(context.server)
      .post('/api/auth/login')
      .send({ email: emailFor('does-not-exist'), password: PASSWORD });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
    assert.equal(wrongPassword.body.message, 'Invalid email or password.');
  });

  it('protects /me and resolves identity only from the token subject', async () => {
    const payload = registrationPayload('me');
    const registration = await request(context.server).post('/api/auth/register').send(payload);
    const token = registration.body.accessToken as string;

    const unauthenticated = await request(context.server).get('/api/auth/me');
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.headers['www-authenticate'], 'Bearer');

    const malformed = await request(context.server)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    assert.equal(malformed.status, 401);

    const authenticated = await request(context.server)
      .get('/api/auth/me?userId=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(authenticated.status, 200);
    assert.equal(authenticated.body.id, registration.body.user.id);
    assert.equal(authenticated.body.email, payload.email);
    expectNoPasswordHash(authenticated.body);

    const jwtService = context.app.get(JwtService);
    const expiredToken = await jwtService.signAsync(
      {
        sub: registration.body.user.id as string,
        role: UserRole.CUSTOMER,
        type: 'access',
      },
      {
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        expiresIn: -1,
      },
    );

    const expired = await request(context.server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(expired.status, 401);
  });

  it('allows only administrators to access admin routes', async () => {
    const customer = await request(context.server)
      .post('/api/auth/register')
      .send(registrationPayload('customer-role'));
    const owner = await request(context.server)
      .post('/api/auth/register')
      .send(registrationPayload('owner-role', { role: UserRole.OWNER }));

    const adminEmail = emailFor('real-admin');
    await context.prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Real',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    const adminLogin = await request(context.server)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: PASSWORD });

    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.body.user.role, UserRole.ADMIN);

    const noAuth = await request(context.server).get('/api/admin/ping');
    assert.equal(noAuth.status, 401);

    const customerAttempt = await request(context.server)
      .get('/api/admin/ping')
      .set('Authorization', `Bearer ${customer.body.accessToken}`);
    assert.equal(customerAttempt.status, 403);

    const ownerAttempt = await request(context.server)
      .get('/api/admin/ping')
      .set('Authorization', `Bearer ${owner.body.accessToken}`);
    assert.equal(ownerAttempt.status, 403);

    const adminAttempt = await request(context.server)
      .get('/api/admin/ping')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
    assert.equal(adminAttempt.status, 200);
    assert.equal(adminAttempt.body.status, 'ok');
  });

  it('rotates web refresh cookies and revokes the family on replay', async () => {
    const agent = request.agent(context.server);
    const registration = await agent
      .post('/api/auth/register')
      .send(registrationPayload('web-refresh'));

    assert.equal(registration.status, 201);
    const originalCookie = refreshCookieValue(registration);

    const refreshed = await agent.post('/api/auth/refresh').send({});
    assert.equal(refreshed.status, 200);
    assert.equal(typeof refreshed.body.accessToken, 'string');
    assert.equal(refreshed.body.refreshToken, undefined);
    const rotatedCookie = refreshCookieValue(refreshed);
    assert.notEqual(rotatedCookie, originalCookie);

    const replay = await request(context.server)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .send({});
    assert.equal(replay.status, 401);
    assert.match(String(replay.body.message), /revoked|used/i);

    const afterReplay = await request(context.server)
      .post('/api/auth/refresh')
      .set('Cookie', rotatedCookie)
      .send({});
    assert.equal(afterReplay.status, 401);
  });

  it('rotates mobile refresh tokens through the request body', async () => {
    const registration = await request(context.server)
      .post('/api/auth/register')
      .send(registrationPayload('mobile-refresh', { client: 'mobile' }));

    const originalToken = registration.body.refreshToken as string;
    assert.equal(typeof originalToken, 'string');

    const refreshed = await request(context.server)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalToken });

    assert.equal(refreshed.status, 200);
    assert.equal(typeof refreshed.body.refreshToken, 'string');
    assert.notEqual(refreshed.body.refreshToken, originalToken);
    assert.equal(setCookies(refreshed).length, 0);

    const invalid = await request(context.server)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'x'.repeat(64) });
    assert.equal(invalid.status, 401);
  });

  it('invalidates the refresh cookie on logout', async () => {
    const agent = request.agent(context.server);
    const registration = await agent.post('/api/auth/register').send(registrationPayload('logout'));
    const cookie = refreshCookieValue(registration);

    const logout = await agent.post('/api/auth/logout').send({});
    assert.equal(logout.status, 200);
    assert.equal(logout.body.success, true);

    const refreshAfterLogout = await request(context.server)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .send({});
    assert.equal(refreshAfterLogout.status, 401);
  });

  it('keeps health and database readiness public and working', async () => {
    const live = await request(context.server).get('/api/health');
    assert.equal(live.status, 200);
    assert.equal(live.body.status, 'ok');

    const database = await request(context.server).get('/api/health/database');
    assert.equal(database.status, 200);
    assert.equal(database.body.database, 'connected');
  });
});

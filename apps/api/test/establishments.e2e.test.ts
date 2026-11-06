import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashPassword } from '../src/auth/password';
import { PrismaService } from '../src/database/prisma.service';
import {
  BookingType,
  DayOfWeek,
  EstablishmentStatus,
  UserRole,
} from '../src/generated/prisma/enums';

process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_DISABLED = 'true';

const TEST_PREFIX = `phase4-${Date.now()}-${randomUUID().slice(0, 8)}`;
const PASSWORD = 'Correct-Horse-Battery-Staple-2026';

interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  server: ReturnType<INestApplication['getHttpServer']>;
}

interface AuthenticatedActor {
  id: string;
  email: string;
  token: string;
}

let context: TestContext;
let ownerA: AuthenticatedActor;
let ownerB: AuthenticatedActor;
let customer: AuthenticatedActor;
let admin: AuthenticatedActor;
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${TEST_PREFIX}-${prefix}-${sequence}-${randomUUID().slice(0, 6)}`;
}

function emailFor(name: string): string {
  return `${nextId(name)}@example.com`;
}

function authHeader(actor: AuthenticatedActor): Record<string, string> {
  return { Authorization: `Bearer ${actor.token}` };
}

async function registerActor(
  name: string,
  role: UserRole = UserRole.OWNER,
): Promise<AuthenticatedActor> {
  const email = emailFor(name);
  const response = await request(context.server).post('/api/auth/register').send({
    email,
    password: PASSWORD,
    firstName: 'Phase',
    lastName: name,
    role,
  });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return {
    id: response.body.user.id as string,
    email,
    token: response.body.accessToken as string,
  };
}

async function createCategory(
  name = 'beauty',
): Promise<{ id: string; name: string; slug: string }> {
  const suffix = nextId('category');
  const response = await request(context.server)
    .post('/api/admin/categories')
    .set(authHeader(admin))
    .send({
      name: `${name} ${suffix}`,
      slug: suffix,
      description: 'Phase 4A test category',
    });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body as { id: string; name: string; slug: string };
}

function establishmentPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const suffix = nextId('establishment');
  return {
    name: `Phase 4 Studio ${suffix}`,
    slug: suffix,
    description: 'A test establishment',
    city: 'Tunis',
    governorate: 'Tunis',
    country: 'TN',
    timezone: 'Africa/Tunis',
    latitude: 36.8065,
    longitude: 10.1815,
    phone: '+216 71 000 000',
    email: 'studio@example.com',
    website: 'https://example.com',
    ...overrides,
  };
}

async function createEstablishment(
  actor: AuthenticatedActor,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request(context.server)
    .post('/api/establishments')
    .set(authHeader(actor))
    .send(establishmentPayload(overrides));

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body as Record<string, unknown>;
}

async function submitAndApprove(establishmentId: string, categoryId: string): Promise<void> {
  const assigned = await request(context.server)
    .put(`/api/establishments/${establishmentId}/categories`)
    .set(authHeader(ownerA))
    .send({ categoryIds: [categoryId] });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));

  const submitted = await request(context.server)
    .post(`/api/establishments/${establishmentId}/submit`)
    .set(authHeader(ownerA));
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));

  const approved = await request(context.server)
    .post(`/api/admin/establishments/${establishmentId}/approve`)
    .set(authHeader(admin));
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
}

async function createService(
  establishmentId: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request(context.server)
    .post(`/api/establishments/${establishmentId}/services`)
    .set(authHeader(ownerA))
    .send({
      name: nextId('service'),
      bookingType: BookingType.APPOINTMENT,
      durationMinutes: 60,
      price: 75.5,
      ...overrides,
    });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body as Record<string, unknown>;
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

  ownerA = await registerActor('owner-a');
  ownerB = await registerActor('owner-b');
  customer = await registerActor('customer', UserRole.CUSTOMER);

  const adminEmail = emailFor('admin');
  await context.prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(PASSWORD),
      firstName: 'Phase',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  const adminLogin = await request(context.server)
    .post('/api/auth/login')
    .send({ email: adminEmail, password: PASSWORD });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
  admin = {
    id: adminLogin.body.user.id as string,
    email: adminEmail,
    token: adminLogin.body.accessToken as string,
  };
});

after(async () => {
  if (!context) {
    return;
  }

  await context.prisma.establishment.deleteMany({
    where: {
      owner: {
        email: { startsWith: TEST_PREFIX },
      },
    },
  });
  await context.prisma.category.deleteMany({
    where: { slug: { startsWith: TEST_PREFIX } },
  });
  await context.prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
  await context.app.close();
});

describe('Phase 4A establishment and service management', () => {
  it('creates, updates, and lists an owner establishment without privileged field access', async () => {
    const category = await createCategory();
    const created = await createEstablishment(ownerA, { categoryIds: [category.id] });

    assert.equal(created.status, EstablishmentStatus.DRAFT);
    assert.equal(created.ownerId, ownerA.id);
    assert.match(created.slug as string, new RegExp(`^${TEST_PREFIX}`));
    assert.equal((created.categories as unknown[]).length, 1);
    assert.equal(created.latitude, 36.8065);
    assert.equal(created.statusReason, null);

    const statusAttempt = await request(context.server)
      .post('/api/establishments')
      .set(authHeader(ownerA))
      .send(establishmentPayload({ status: EstablishmentStatus.ACTIVE }));

    assert.equal(statusAttempt.status, 400);
    assert.match(JSON.stringify(statusAttempt.body.message), /status/);

    const ownerAttempt = await request(context.server)
      .post('/api/establishments')
      .set(authHeader(ownerA))
      .send(establishmentPayload({ ownerId: ownerB.id }));

    assert.equal(ownerAttempt.status, 400);
    assert.match(JSON.stringify(ownerAttempt.body.message), /ownerId/);

    const updated = await request(context.server)
      .patch(`/api/establishments/${created.id as string}`)
      .set(authHeader(ownerA))
      .send({
        name: 'Updated Phase 4 Studio',
        description: null,
        latitude: 37.25,
      });

    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.name, 'Updated Phase 4 Studio');
    assert.equal(updated.body.description, null);
    assert.equal(updated.body.latitude, 37.25);
    assert.equal(updated.body.longitude, 10.1815);
    assert.equal(updated.body.status, EstablishmentStatus.DRAFT);
    assert.equal(updated.body.ownerId, ownerA.id);

    const list = await request(context.server)
      .get('/api/establishments?limit=100')
      .set(authHeader(ownerA));

    assert.equal(list.status, 200);
    assert.ok(
      (list.body.data as Array<{ id: string }>).some(
        (establishment) => establishment.id === created.id,
      ),
    );
    assert.equal(list.body.meta.page, 1);

    const status = await request(context.server)
      .get(`/api/establishments/${created.id as string}/status`)
      .set(authHeader(ownerA));
    assert.equal(status.status, 200);
    assert.equal(status.body.status, EstablishmentStatus.DRAFT);

    const invalidCoordinates = await request(context.server)
      .post('/api/establishments')
      .set(authHeader(ownerA))
      .send(establishmentPayload({ latitude: 91 }));
    assert.equal(invalidCoordinates.status, 400);

    const unpairedCoordinates = await request(context.server)
      .post('/api/establishments')
      .set(authHeader(ownerA))
      .send(establishmentPayload({ latitude: 36.8, longitude: undefined }));
    assert.equal(unpairedCoordinates.status, 400);
    assert.match(JSON.stringify(unpairedCoordinates.body.message), /latitude and longitude/);

    const invalidTimezone = await request(context.server)
      .post('/api/establishments')
      .set(authHeader(ownerA))
      .send(establishmentPayload({ timezone: 'Mars/Olympus_Mons' }));
    assert.equal(invalidTimezone.status, 400);
  });

  it('isolates establishments between owners and hides inaccessible records with 404', async () => {
    const created = await createEstablishment(ownerA);
    const id = created.id as string;

    const hidden = await request(context.server)
      .get(`/api/establishments/${id}`)
      .set(authHeader(ownerB));
    assert.equal(hidden.status, 404);
    assert.equal(hidden.body.message, 'Establishment not found.');

    const hiddenUpdate = await request(context.server)
      .patch(`/api/establishments/${id}`)
      .set(authHeader(ownerB))
      .send({ name: 'Hijacked' });
    assert.equal(hiddenUpdate.status, 404);

    const hiddenSubmit = await request(context.server)
      .post(`/api/establishments/${id}/submit`)
      .set(authHeader(ownerB));
    assert.equal(hiddenSubmit.status, 404);

    const hiddenStatus = await request(context.server)
      .get(`/api/establishments/${id}/status`)
      .set(authHeader(ownerB));
    assert.equal(hiddenStatus.status, 404);

    const ownerBList = await request(context.server)
      .get('/api/establishments?limit=100')
      .set(authHeader(ownerB));
    assert.equal(ownerBList.status, 200);
    assert.equal(
      (ownerBList.body.data as Array<{ id: string }>).some(
        (establishment) => establishment.id === id,
      ),
      false,
    );

    const missing = await request(context.server)
      .get(`/api/establishments/${randomUUID()}`)
      .set(authHeader(ownerA));
    assert.equal(missing.status, 404);

    const unauthenticated = await request(context.server).get('/api/establishments');
    assert.equal(unauthenticated.status, 401);

    const wrongRole = await request(context.server)
      .get('/api/establishments')
      .set(authHeader(customer));
    assert.equal(wrongRole.status, 403);

    const adminView = await request(context.server)
      .get(`/api/admin/establishments/${id}`)
      .set(authHeader(admin));
    assert.equal(adminView.status, 200);
    assert.equal(adminView.body.owner.id, ownerA.id);
    assert.equal(JSON.stringify(adminView.body).includes('passwordHash'), false);
  });

  it('restricts category management to administrators and enforces active categories', async () => {
    const category = await createCategory('wellness');

    const publicList = await request(context.server).get('/api/categories?limit=100');
    assert.equal(publicList.status, 200);
    assert.ok(
      (publicList.body.data as Array<{ id: string }>).some((item) => item.id === category.id),
    );

    const ownerAttempt = await request(context.server)
      .post('/api/admin/categories')
      .set(authHeader(ownerA))
      .send({ name: 'Forbidden category', slug: nextId('forbidden') });
    assert.equal(ownerAttempt.status, 403);

    const duplicate = await request(context.server)
      .post('/api/admin/categories')
      .set(authHeader(admin))
      .send({ name: category.name, slug: nextId('duplicate') });
    assert.equal(duplicate.status, 409);

    const deactivated = await request(context.server)
      .post(`/api/admin/categories/${category.id}/deactivate`)
      .set(authHeader(admin));
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.isActive, false);

    const publicAfterDeactivate = await request(context.server).get('/api/categories?limit=100');
    assert.equal(
      (publicAfterDeactivate.body.data as Array<{ id: string }>).some(
        (item) => item.id === category.id,
      ),
      false,
    );

    const created = await createEstablishment(ownerA);
    const inactiveAssignment = await request(context.server)
      .put(`/api/establishments/${created.id as string}/categories`)
      .set(authHeader(ownerA))
      .send({ categoryIds: [category.id] });
    assert.equal(inactiveAssignment.status, 400);

    const unknownAssignment = await request(context.server)
      .put(`/api/establishments/${created.id as string}/categories`)
      .set(authHeader(ownerA))
      .send({ categoryIds: [randomUUID()] });
    assert.equal(unknownAssignment.status, 400);

    const duplicateAssignment = await request(context.server)
      .put(`/api/establishments/${created.id as string}/categories`)
      .set(authHeader(ownerA))
      .send({ categoryIds: [category.id, category.id] });
    assert.equal(duplicateAssignment.status, 400);

    const activated = await request(context.server)
      .post(`/api/admin/categories/${category.id}/activate`)
      .set(authHeader(admin));
    assert.equal(activated.status, 200);
    assert.equal(activated.body.isActive, true);
  });

  it('requires administrator approval before an establishment becomes public', async () => {
    const category = await createCategory('pilates');
    const created = await createEstablishment(ownerA);
    const id = created.id as string;
    const slug = created.slug as string;

    const submitWithoutCategory = await request(context.server)
      .post(`/api/establishments/${id}/submit`)
      .set(authHeader(ownerA));
    assert.equal(submitWithoutCategory.status, 400);

    const assigned = await request(context.server)
      .put(`/api/establishments/${id}/categories`)
      .set(authHeader(ownerA))
      .send({ categoryIds: [category.id] });
    assert.equal(assigned.status, 200);

    const submitted = await request(context.server)
      .post(`/api/establishments/${id}/submit`)
      .set(authHeader(ownerA));
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.status, EstablishmentStatus.PENDING);

    const selfApprove = await request(context.server)
      .post(`/api/admin/establishments/${id}/approve`)
      .set(authHeader(ownerA));
    assert.equal(selfApprove.status, 403);

    const publicPending = await request(context.server).get(`/api/public/establishments/${slug}`);
    assert.equal(publicPending.status, 404);

    const publicListPending = await request(context.server).get(
      `/api/public/establishments?q=${encodeURIComponent(String(created.name))}`,
    );
    assert.equal(publicListPending.status, 200);
    assert.equal(
      (publicListPending.body.data as Array<{ id: string }>).some(
        (establishment) => establishment.id === id,
      ),
      false,
    );

    const approved = await request(context.server)
      .post(`/api/admin/establishments/${id}/approve`)
      .set(authHeader(admin));
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, EstablishmentStatus.ACTIVE);
    assert.equal(approved.body.statusReason, null);

    const publicDetail = await request(context.server).get(`/api/public/establishments/${slug}`);
    assert.equal(publicDetail.status, 200);
    assert.equal(publicDetail.body.id, id);
    assert.equal(publicDetail.body.ownerId, undefined);
    assert.equal(publicDetail.body.status, undefined);
    assert.equal(publicDetail.body.statusReason, undefined);
    assert.equal(JSON.stringify(publicDetail.body).includes(ownerA.email), false);

    const publicListActive = await request(context.server).get(
      `/api/public/establishments?q=${encodeURIComponent(String(created.name))}`,
    );
    assert.ok(
      (publicListActive.body.data as Array<{ id: string }>).some(
        (establishment) => establishment.id === id,
      ),
    );

    const duplicateSubmit = await request(context.server)
      .post(`/api/establishments/${id}/submit`)
      .set(authHeader(ownerA));
    assert.equal(duplicateSubmit.status, 409);

    const bypassStatus = await request(context.server)
      .patch(`/api/establishments/${id}`)
      .set(authHeader(ownerA))
      .send({ status: EstablishmentStatus.ACTIVE });
    assert.equal(bypassStatus.status, 400);
  });

  it('records rejection and suspension reasons and removes public visibility', async () => {
    const category = await createCategory('sports');
    const created = await createEstablishment(ownerA);
    const id = created.id as string;
    const slug = created.slug as string;

    await request(context.server)
      .put(`/api/establishments/${id}/categories`)
      .set(authHeader(ownerA))
      .send({ categoryIds: [category.id] })
      .expect(200);
    await request(context.server)
      .post(`/api/establishments/${id}/submit`)
      .set(authHeader(ownerA))
      .expect(200);

    const emptyReason = await request(context.server)
      .post(`/api/admin/establishments/${id}/reject`)
      .set(authHeader(admin))
      .send({ reason: '   ' });
    assert.equal(emptyReason.status, 400);

    const rejected = await request(context.server)
      .post(`/api/admin/establishments/${id}/reject`)
      .set(authHeader(admin))
      .send({ reason: 'Address could not be verified.' });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, EstablishmentStatus.REJECTED);
    assert.equal(rejected.body.statusReason, 'Address could not be verified.');

    const hiddenAfterReject = await request(context.server).get(
      `/api/public/establishments/${slug}`,
    );
    assert.equal(hiddenAfterReject.status, 404);

    const resubmitted = await request(context.server)
      .post(`/api/establishments/${id}/submit`)
      .set(authHeader(ownerA));
    assert.equal(resubmitted.status, 200);
    assert.equal(resubmitted.body.status, EstablishmentStatus.PENDING);
    assert.equal(resubmitted.body.statusReason, null);

    await request(context.server)
      .post(`/api/admin/establishments/${id}/approve`)
      .set(authHeader(admin))
      .expect(200);

    const suspended = await request(context.server)
      .post(`/api/admin/establishments/${id}/suspend`)
      .set(authHeader(admin))
      .send({ reason: 'Temporary compliance hold.' });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, EstablishmentStatus.SUSPENDED);
    assert.equal(suspended.body.statusReason, 'Temporary compliance hold.');

    const hiddenAfterSuspend = await request(context.server).get(
      `/api/public/establishments/${slug}`,
    );
    assert.equal(hiddenAfterSuspend.status, 404);

    const approveSuspended = await request(context.server)
      .post(`/api/admin/establishments/${id}/approve`)
      .set(authHeader(admin));
    assert.equal(approveSuspended.status, 409);
  });

  it('validates services, enforces ownership, and exposes only eligible public services', async () => {
    const category = await createCategory('fitness');
    const created = await createEstablishment(ownerA);
    const establishmentId = created.id as string;

    const appointment = await createService(establishmentId, {
      name: nextId('appointment'),
      bookingType: BookingType.APPOINTMENT,
      durationMinutes: 60,
      price: 75.5,
    });

    assert.equal(appointment.capacity, 1);
    assert.equal(appointment.currency, 'TND');
    assert.equal(appointment.price, '75.500');
    assert.equal(appointment.isActive, true);

    const classService = await createService(establishmentId, {
      name: nextId('class'),
      bookingType: BookingType.CLASS,
      durationMinutes: 45,
      capacity: 10,
      price: 35,
    });
    assert.equal(classService.capacity, 10);

    const invalidClass = await request(context.server)
      .post(`/api/establishments/${establishmentId}/services`)
      .set(authHeader(ownerA))
      .send({
        name: nextId('invalid-class'),
        bookingType: BookingType.CLASS,
        durationMinutes: 45,
        capacity: 1,
        price: 20,
      });
    assert.equal(invalidClass.status, 400);

    const invalidPrice = await request(context.server)
      .post(`/api/establishments/${establishmentId}/services`)
      .set(authHeader(ownerA))
      .send({
        name: nextId('invalid-price'),
        bookingType: BookingType.APPOINTMENT,
        durationMinutes: 30,
        price: 0,
      });
    assert.equal(invalidPrice.status, 400);

    const invalidCurrency = await request(context.server)
      .post(`/api/establishments/${establishmentId}/services`)
      .set(authHeader(ownerA))
      .send({
        name: nextId('invalid-currency'),
        bookingType: BookingType.APPOINTMENT,
        durationMinutes: 30,
        price: 10,
        currency: 'EURO',
      });
    assert.equal(invalidCurrency.status, 400);

    const invalidDuration = await request(context.server)
      .post(`/api/establishments/${establishmentId}/services`)
      .set(authHeader(ownerA))
      .send({
        name: nextId('invalid-duration'),
        bookingType: BookingType.APPOINTMENT,
        durationMinutes: 0,
        price: 10,
      });
    assert.equal(invalidDuration.status, 400);

    const ownershipInjection = await request(context.server)
      .post(`/api/establishments/${establishmentId}/services`)
      .set(authHeader(ownerA))
      .send({
        name: nextId('ownership'),
        establishmentId: randomUUID(),
        bookingType: BookingType.APPOINTMENT,
        durationMinutes: 30,
        price: 10,
      });
    assert.equal(ownershipInjection.status, 400);

    const otherOwnerGet = await request(context.server)
      .get(`/api/establishments/${establishmentId}/services/${appointment.id as string}`)
      .set(authHeader(ownerB));
    assert.equal(otherOwnerGet.status, 404);

    const otherOwnerList = await request(context.server)
      .get(`/api/establishments/${establishmentId}/services`)
      .set(authHeader(ownerB));
    assert.equal(otherOwnerList.status, 404);

    const statusUpdate = await request(context.server)
      .patch(`/api/establishments/${establishmentId}/services/${appointment.id as string}`)
      .set(authHeader(ownerA))
      .send({ isActive: false });
    assert.equal(statusUpdate.status, 400);

    const deactivated = await request(context.server)
      .post(
        `/api/establishments/${establishmentId}/services/${classService.id as string}/deactivate`,
      )
      .set(authHeader(ownerA));
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.isActive, false);

    const hiddenWhileDraft = await request(context.server).get(
      `/api/public/services?establishmentId=${establishmentId}`,
    );
    assert.equal(hiddenWhileDraft.status, 200);
    assert.equal((hiddenWhileDraft.body.data as unknown[]).length, 0);

    await submitAndApprove(establishmentId, category.id);

    const publicServices = await request(context.server).get(
      `/api/public/services?establishmentId=${establishmentId}&limit=100`,
    );
    assert.equal(publicServices.status, 200);
    assert.equal((publicServices.body.data as unknown[]).length, 1);
    const publicService = publicServices.body.data[0] as Record<string, unknown>;
    assert.equal(publicService.id, appointment.id);
    assert.equal(publicService.price, '75.500');
    assert.equal(publicService.isActive, true);
    assert.equal(publicService.ownerId, undefined);
    assert.equal((publicService.establishment as Record<string, unknown>).id, establishmentId);
    assert.equal(JSON.stringify(publicService).includes(ownerA.email), false);

    const publicDetail = await request(context.server).get(
      `/api/public/services/${appointment.id as string}`,
    );
    assert.equal(publicDetail.status, 200);

    const inactiveDetail = await request(context.server).get(
      `/api/public/services/${classService.id as string}`,
    );
    assert.equal(inactiveDetail.status, 404);
  });

  it('supports split business hours and rejects invalid or overlapping intervals', async () => {
    const created = await createEstablishment(ownerA);
    const establishmentId = created.id as string;

    const morning = await request(context.server)
      .post(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerA))
      .send({
        dayOfWeek: DayOfWeek.MONDAY,
        opensAtMinute: 540,
        closesAtMinute: 720,
      });
    assert.equal(morning.status, 201, JSON.stringify(morning.body));

    const evening = await request(context.server)
      .post(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerA))
      .send({
        dayOfWeek: DayOfWeek.MONDAY,
        opensAtMinute: 840,
        closesAtMinute: 1080,
      });
    assert.equal(evening.status, 201);

    const anotherDay = await request(context.server)
      .post(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerA))
      .send({
        dayOfWeek: DayOfWeek.TUESDAY,
        opensAtMinute: 540,
        closesAtMinute: 720,
      });
    assert.equal(anotherDay.status, 201);

    const list = await request(context.server)
      .get(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerA));
    assert.equal(list.status, 200);
    assert.equal(list.body.timezone, 'Africa/Tunis');
    assert.equal((list.body.intervals as unknown[]).length, 3);

    const overlap = await request(context.server)
      .post(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerA))
      .send({
        dayOfWeek: DayOfWeek.MONDAY,
        opensAtMinute: 600,
        closesAtMinute: 900,
      });
    assert.equal(overlap.status, 400);

    const invalidRange = await request(context.server)
      .post(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerA))
      .send({
        dayOfWeek: DayOfWeek.MONDAY,
        opensAtMinute: 900,
        closesAtMinute: 720,
      });
    assert.equal(invalidRange.status, 400);

    const otherOwnerList = await request(context.server)
      .get(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerB));
    assert.equal(otherOwnerList.status, 404);

    const otherOwnerCreate = await request(context.server)
      .post(`/api/establishments/${establishmentId}/business-hours`)
      .set(authHeader(ownerB))
      .send({
        dayOfWeek: DayOfWeek.WEDNESDAY,
        opensAtMinute: 540,
        closesAtMinute: 720,
      });
    assert.equal(otherOwnerCreate.status, 404);

    const updated = await request(context.server)
      .patch(`/api/establishments/${establishmentId}/business-hours/${morning.body.id as string}`)
      .set(authHeader(ownerA))
      .send({ closesAtMinute: 780 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.closesAtMinute, 780);

    const deleted = await request(context.server)
      .delete(
        `/api/establishments/${establishmentId}/business-hours/${anotherDay.body.id as string}`,
      )
      .set(authHeader(ownerA));
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.success, true);
  });

  it('manages establishment-wide and service-specific unavailable periods with ownership checks', async () => {
    const created = await createEstablishment(ownerA);
    const establishmentId = created.id as string;
    const service = await createService(establishmentId, {
      name: nextId('unavailable-service'),
    });

    const wide = await request(context.server)
      .post(`/api/establishments/${establishmentId}/unavailable-periods`)
      .set(authHeader(ownerA))
      .send({
        startsAt: '2026-12-24T08:00:00.000Z',
        endsAt: '2026-12-24T18:00:00.000Z',
        reason: 'Public holiday',
      });
    assert.equal(wide.status, 201, JSON.stringify(wide.body));
    assert.equal(wide.body.serviceId, null);

    const serviceSpecific = await request(context.server)
      .post(`/api/establishments/${establishmentId}/unavailable-periods`)
      .set(authHeader(ownerA))
      .send({
        startsAt: '2026-12-25T09:00:00.000Z',
        endsAt: '2026-12-25T12:00:00.000Z',
        serviceId: service.id,
      });
    assert.equal(serviceSpecific.status, 201);
    assert.equal(serviceSpecific.body.serviceId, service.id);

    const list = await request(context.server)
      .get(`/api/establishments/${establishmentId}/unavailable-periods?limit=100`)
      .set(authHeader(ownerA));
    assert.equal(list.status, 200);
    assert.equal((list.body.data as unknown[]).length, 2);

    const invalidRange = await request(context.server)
      .post(`/api/establishments/${establishmentId}/unavailable-periods`)
      .set(authHeader(ownerA))
      .send({
        startsAt: '2026-12-26T18:00:00.000Z',
        endsAt: '2026-12-26T08:00:00.000Z',
      });
    assert.equal(invalidRange.status, 400);

    const otherEstablishment = await createEstablishment(ownerB);
    const otherService = await request(context.server)
      .post(`/api/establishments/${otherEstablishment.id as string}/services`)
      .set(authHeader(ownerB))
      .send({
        name: nextId('other-service'),
        bookingType: BookingType.APPOINTMENT,
        durationMinutes: 30,
        price: 20,
      });
    assert.equal(otherService.status, 201);

    const foreignService = await request(context.server)
      .post(`/api/establishments/${establishmentId}/unavailable-periods`)
      .set(authHeader(ownerA))
      .send({
        startsAt: '2026-12-27T09:00:00.000Z',
        endsAt: '2026-12-27T12:00:00.000Z',
        serviceId: otherService.body.id,
      });
    assert.equal(foreignService.status, 400);

    const otherOwnerList = await request(context.server)
      .get(`/api/establishments/${establishmentId}/unavailable-periods`)
      .set(authHeader(ownerB));
    assert.equal(otherOwnerList.status, 404);

    const otherOwnerCreate = await request(context.server)
      .post(`/api/establishments/${establishmentId}/unavailable-periods`)
      .set(authHeader(ownerB))
      .send({
        startsAt: '2026-12-28T09:00:00.000Z',
        endsAt: '2026-12-28T12:00:00.000Z',
      });
    assert.equal(otherOwnerCreate.status, 404);

    const updated = await request(context.server)
      .patch(
        `/api/establishments/${establishmentId}/unavailable-periods/${serviceSpecific.body.id as string}`,
      )
      .set(authHeader(ownerA))
      .send({ serviceId: null, reason: 'Now establishment-wide' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.serviceId, null);
    assert.equal(updated.body.reason, 'Now establishment-wide');

    const deleted = await request(context.server)
      .delete(
        `/api/establishments/${establishmentId}/unavailable-periods/${wide.body.id as string}`,
      )
      .set(authHeader(ownerA));
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.success, true);
  });

  it('returns consistent errors for missing nested resources and public routes', async () => {
    const created = await createEstablishment(ownerA);
    const establishmentId = created.id as string;
    const missingId = randomUUID();

    const missingService = await request(context.server)
      .get(`/api/establishments/${establishmentId}/services/${missingId}`)
      .set(authHeader(ownerA));
    assert.equal(missingService.status, 404);
    assert.equal(missingService.body.error, 'Not Found');

    const missingHours = await request(context.server)
      .patch(`/api/establishments/${establishmentId}/business-hours/${missingId}`)
      .set(authHeader(ownerA))
      .send({ closesAtMinute: 720 });
    assert.equal(missingHours.status, 404);

    const missingPeriod = await request(context.server)
      .delete(`/api/establishments/${establishmentId}/unavailable-periods/${missingId}`)
      .set(authHeader(ownerA));
    assert.equal(missingPeriod.status, 404);

    const missingAdminEstablishment = await request(context.server)
      .get(`/api/admin/establishments/${missingId}`)
      .set(authHeader(admin));
    assert.equal(missingAdminEstablishment.status, 404);

    const missingPublic = await request(context.server).get(
      `/api/public/establishments/does-not-exist-${TEST_PREFIX}`,
    );
    assert.equal(missingPublic.status, 404);
    assert.equal(missingPublic.body.statusCode, 404);
    assert.equal(typeof missingPublic.body.timestamp, 'string');

    const publicCategories = await request(context.server).get('/api/categories');
    assert.equal(publicCategories.status, 200);
    assert.equal(publicCategories.body.meta.page, 1);
  });
});

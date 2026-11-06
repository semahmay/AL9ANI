-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstablishmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('APPOINTMENT', 'CLASS', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(32),
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Establishment" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "EstablishmentStatus" NOT NULL DEFAULT 'DRAFT',
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "website" VARCHAR(500),
    "addressLine" VARCHAR(255),
    "city" VARCHAR(120) NOT NULL,
    "governorate" VARCHAR(120),
    "postalCode" VARCHAR(20),
    "country" CHAR(2) NOT NULL DEFAULT 'TN',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Tunis',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstablishmentCategory" (
    "establishmentId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstablishmentCategory_pkey" PRIMARY KEY ("establishmentId","categoryId")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "bookingType" "BookingType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "currency" CHAR(3) NOT NULL DEFAULT 'TND',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "opensAtMinute" INTEGER NOT NULL,
    "closesAtMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnavailablePeriod" (
    "id" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "serviceId" UUID,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UnavailablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "currency" CHAR(3) NOT NULL DEFAULT 'TND',
    "notes" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","establishmentId")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "planName" VARCHAR(80) NOT NULL DEFAULT 'Standard',
    "price" DECIMAL(10,3) NOT NULL DEFAULT 69.000,
    "currency" CHAR(3) NOT NULL DEFAULT 'TND',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMPTZ(3),
    "currentPeriodEnd" TIMESTAMPTZ(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_slug_key" ON "Establishment"("slug");

-- CreateIndex
CREATE INDEX "Establishment_ownerId_idx" ON "Establishment"("ownerId");

-- CreateIndex
CREATE INDEX "Establishment_status_city_idx" ON "Establishment"("status", "city");

-- CreateIndex
CREATE INDEX "Establishment_city_idx" ON "Establishment"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "EstablishmentCategory_categoryId_idx" ON "EstablishmentCategory"("categoryId");

-- CreateIndex
CREATE INDEX "Service_establishmentId_isActive_idx" ON "Service"("establishmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Service_establishmentId_name_key" ON "Service"("establishmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_establishmentId_dayOfWeek_opensAtMinute_close_key" ON "BusinessHours"("establishmentId", "dayOfWeek", "opensAtMinute", "closesAtMinute");

-- CreateIndex
CREATE INDEX "UnavailablePeriod_establishmentId_startsAt_endsAt_idx" ON "UnavailablePeriod"("establishmentId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "UnavailablePeriod_serviceId_startsAt_endsAt_idx" ON "UnavailablePeriod"("serviceId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Reservation_customerId_startsAt_idx" ON "Reservation"("customerId", "startsAt");

-- CreateIndex
CREATE INDEX "Reservation_establishmentId_startsAt_endsAt_idx" ON "Reservation"("establishmentId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Reservation_serviceId_startsAt_endsAt_idx" ON "Reservation"("serviceId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Reservation_status_startsAt_idx" ON "Reservation"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Favorite_establishmentId_idx" ON "Favorite"("establishmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_establishmentId_key" ON "Subscription"("establishmentId");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstablishmentCategory" ADD CONSTRAINT "EstablishmentCategory_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstablishmentCategory" ADD CONSTRAINT "EstablishmentCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnavailablePeriod" ADD CONSTRAINT "UnavailablePeriod_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnavailablePeriod" ADD CONSTRAINT "UnavailablePeriod_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data integrity checks that Prisma's schema language cannot express.
-- Reservation overlap and capacity rules still require application-level
-- transactional logic because they depend on the service booking type.

ALTER TABLE "Establishment"
    ADD CONSTRAINT "Establishment_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "Establishment_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "Service"
    ADD CONSTRAINT "Service_durationMinutes_check" CHECK ("durationMinutes" > 0),
    ADD CONSTRAINT "Service_capacity_check" CHECK ("capacity" > 0),
    ADD CONSTRAINT "Service_price_check" CHECK ("price" >= 0);

ALTER TABLE "BusinessHours"
    ADD CONSTRAINT "BusinessHours_minutes_check" CHECK (
        "opensAtMinute" >= 0
        AND "closesAtMinute" <= 1440
        AND "opensAtMinute" < "closesAtMinute"
    );

ALTER TABLE "UnavailablePeriod"
    ADD CONSTRAINT "UnavailablePeriod_time_range_check" CHECK ("endsAt" > "startsAt");

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_time_range_check" CHECK ("endsAt" > "startsAt"),
    ADD CONSTRAINT "Reservation_partySize_check" CHECK ("partySize" > 0),
    ADD CONSTRAINT "Reservation_price_check" CHECK ("price" >= 0);

ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_price_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "Subscription_period_check" CHECK (
        "currentPeriodStart" IS NULL
        OR "currentPeriodEnd" IS NULL
        OR "currentPeriodEnd" > "currentPeriodStart"
    );

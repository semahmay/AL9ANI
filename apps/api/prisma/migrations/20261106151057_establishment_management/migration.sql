-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstablishmentStatus" ADD VALUE 'PENDING';
ALTER TYPE "EstablishmentStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "statusReason" VARCHAR(500);

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

/*
  Warnings:

  - You are about to drop the column `accessToken` on the `SocialAccount` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `SocialAccount` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `SocialAccount` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[siteId,platform]` on the table `SocialAccount` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `credentials` to the `SocialAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `siteId` to the `SocialAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `socialAccountId` to the `SocialShare` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SocialPlatform" ADD VALUE 'THREADS';
ALTER TYPE "SocialPlatform" ADD VALUE 'YOUTUBE';

-- DropIndex
DROP INDEX "SocialAccount_userId_platform_key";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "focusKeyword" TEXT,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "readabilityScore" INTEGER,
ADD COLUMN     "schemaMarkup" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "SocialAccount" DROP COLUMN "accessToken",
DROP COLUMN "accountId",
DROP COLUMN "refreshToken",
ADD COLUMN     "credentials" JSONB NOT NULL,
ADD COLUMN     "siteId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SocialShare" ADD COLUMN     "socialAccountId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_siteId_platform_key" ON "SocialAccount"("siteId", "platform");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialShare" ADD CONSTRAINT "SocialShare_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

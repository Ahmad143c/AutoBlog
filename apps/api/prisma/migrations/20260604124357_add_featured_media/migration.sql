/*
  Warnings:

  - You are about to drop the column `author` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "author",
ADD COLUMN     "featuredImageUrl" TEXT,
ADD COLUMN     "featuredMediaId" INTEGER;

/*
  Warnings:

  - You are about to drop the column `endsAt` on the `Auction` table. All the data in the column will be lost.
  - Added the required column `biddingEndsAt` to the `Auction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "endsAt",
ADD COLUMN     "biddingEndsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 10;

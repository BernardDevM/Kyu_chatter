/*
  Warnings:

  - You are about to alter the column `bytes` on the `media` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "media" ALTER COLUMN "bytes" SET DATA TYPE INTEGER;

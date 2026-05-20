-- AlterTable
ALTER TABLE `users` ADD COLUMN `allocationEmergency` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `allocationSavings` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `allocationWishlist` INTEGER NOT NULL DEFAULT 0;

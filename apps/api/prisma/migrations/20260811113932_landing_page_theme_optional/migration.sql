-- DropForeignKey
ALTER TABLE `landing_pages` DROP FOREIGN KEY `landing_pages_theme_id_fkey`;

-- DropIndex
DROP INDEX `landing_pages_theme_id_fkey` ON `landing_pages`;

-- AlterTable
ALTER TABLE `landing_pages` MODIFY `theme_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `landing_pages` ADD CONSTRAINT `landing_pages_theme_id_fkey` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

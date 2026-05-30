-- AlterTable
ALTER TABLE `api_keys` ADD COLUMN `expires_at` DATETIME(3) NULL,
    ADD COLUMN `scope` VARCHAR(191) NOT NULL DEFAULT 'readwrite';

-- AlterTable
ALTER TABLE `records` ADD COLUMN `owner_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `end_users` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `end_users_app_id_idx`(`app_id`),
    UNIQUE INDEX `end_users_app_id_email_key`(`app_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_stats` (
    `id` VARCHAR(191) NOT NULL,
    `app_id` VARCHAR(191) NOT NULL,
    `api_key_id` VARCHAR(191) NULL,
    `bucket` DATETIME(3) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `status_class` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    INDEX `usage_stats_app_id_bucket_idx`(`app_id`, `bucket`),
    UNIQUE INDEX `usage_stats_app_id_api_key_id_bucket_method_status_class_key`(`app_id`, `api_key_id`, `bucket`, `method`, `status_class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `records_app_id_collection_owner_id_idx` ON `records`(`app_id`, `collection`, `owner_id`);

-- AddForeignKey
ALTER TABLE `end_users` ADD CONSTRAINT `end_users_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_stats` ADD CONSTRAINT `usage_stats_app_id_fkey` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

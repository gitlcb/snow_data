-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(191) NULL,
    ADD COLUMN `disabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `oauth_id` VARCHAR(191) NULL,
    ADD COLUMN `oauth_provider` VARCHAR(191) NULL,
    ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'user',
    MODIFY `password` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `system_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `registration_open` BOOLEAN NOT NULL DEFAULT true,
    `linuxdo_enabled` BOOLEAN NOT NULL DEFAULT false,
    `linuxdo_client_id` VARCHAR(191) NULL,
    `linuxdo_client_secret` VARCHAR(191) NULL,
    `upload_max_bytes` INTEGER NOT NULL DEFAULT 10485760,
    `upload_allowed_mime` VARCHAR(2000) NOT NULL DEFAULT '',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_oauth_provider_oauth_id_key` ON `users`(`oauth_provider`, `oauth_id`);


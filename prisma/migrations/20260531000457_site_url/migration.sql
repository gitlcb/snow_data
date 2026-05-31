-- AlterTable: 为系统配置增加对外站点地址列；空串=按请求自动识别（保持原行为）
ALTER TABLE `system_config` ADD COLUMN `site_url` VARCHAR(255) NOT NULL DEFAULT '';

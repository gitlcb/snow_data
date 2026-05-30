-- AlterTable: 为 API Key 增加明文列（可空），供随时查看/选用；老 key 留空不可回填
ALTER TABLE `api_keys` ADD COLUMN `key_plain` VARCHAR(80) NULL;

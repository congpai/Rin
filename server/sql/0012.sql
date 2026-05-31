-- Comment replies (one level)
ALTER TABLE `comments` ADD COLUMN `parent_id` integer REFERENCES `comments`(`id`) ON DELETE cascade;

--> statement-breakpoint
ALTER TABLE `moment_comments` ADD COLUMN `parent_id` integer REFERENCES `moment_comments`(`id`) ON DELETE cascade;

--> statement-breakpoint
UPDATE `info` SET `value` = '12' WHERE `key` = 'migration_version';

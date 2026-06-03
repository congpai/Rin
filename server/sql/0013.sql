-- Reply target for flat thread display (who the user is addressing)
ALTER TABLE `comments` ADD COLUMN `reply_to_id` integer REFERENCES `comments`(`id`) ON DELETE set null;

ALTER TABLE `moment_comments` ADD COLUMN `reply_to_id` integer REFERENCES `moment_comments`(`id`) ON DELETE set null;

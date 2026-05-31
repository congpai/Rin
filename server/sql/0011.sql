-- Moment comments (动态评论)
CREATE TABLE IF NOT EXISTS `moment_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`moment_id` integer NOT NULL,
	`user_id` integer,
	`content` text NOT NULL,
	`guest_name` text DEFAULT '',
	`guest_email` text DEFAULT '',
	`guest_website` text DEFAULT '',
	`approved` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`moment_id`) REFERENCES `moments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
UPDATE `info` SET `value` = '11' WHERE `key` = 'migration_version';

CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
	`id` integer PRIMARY KEY,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (`email`);

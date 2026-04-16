ALTER TABLE `concerts` ADD `videoStatus` enum('none','queued','generating','complete','failed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `concerts` ADD `videoUrl` text;--> statement-breakpoint
ALTER TABLE `concerts` ADD `videoPrompt` text;--> statement-breakpoint
ALTER TABLE `concerts` ADD `videoJobId` varchar(255);--> statement-breakpoint
ALTER TABLE `concerts` ADD `videoError` text;
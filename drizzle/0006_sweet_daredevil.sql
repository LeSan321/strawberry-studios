CREATE TABLE `campaign_mood_board_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(512),
	`label` varchar(128),
	`isPrimary` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_mood_board_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `moodBoardPrimaryImageUrl` text;
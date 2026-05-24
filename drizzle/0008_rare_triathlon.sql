ALTER TABLE `campaigns` ADD `coverArtUrl` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `coverArtSource` enum('generated','uploaded','none') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `coverArtGeneratedAt` bigint;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `coverArtRegenerationsUsed` int DEFAULT 0 NOT NULL;
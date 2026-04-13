CREATE TABLE `audio_tracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`durationSeconds` int,
	`mimeType` varchar(64),
	`fileSizeBytes` int,
	`trimStartSeconds` int DEFAULT 0,
	`trimEndSeconds` int,
	`normalized` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audio_tracks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cinematique_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`fabricPhysics` text,
	`lightingKelvin` int,
	`cameraPsychology` text,
	`promptTemplate` text,
	`thumbnailUrl` text,
	`isActive` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cinematique_presets_id` PRIMARY KEY(`id`),
	CONSTRAINT `cinematique_presets_name_unique` UNIQUE(`name`),
	CONSTRAINT `cinematique_presets_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `concert_characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`concertId` int NOT NULL,
	`characterType` enum('the_red_head_singer','the_fedora_man','custom') NOT NULL,
	`referenceImageUrl` text,
	`referenceImageKey` varchar(512),
	`role` enum('lead','supporting','background') DEFAULT 'lead',
	`customDescription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `concert_characters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `concerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`audioTrackId` int,
	`title` varchar(255) NOT NULL,
	`artistName` varchar(255),
	`venue` enum('velvet_strawberry_jazz_club','strawberry_in_the_round','berries_on_the_rocks') NOT NULL DEFAULT 'velvet_strawberry_jazz_club',
	`moodPreset` enum('intimate_jazz','high_energy','noir_smoke','custom') DEFAULT 'intimate_jazz',
	`visualPreset` enum('shadow_and_smoke','golden_rim','venetian_cage','match_flare','none') DEFAULT 'shadow_and_smoke',
	`cameraStyle` varchar(128),
	`lightingKelvin` int,
	`customMoodDescription` text,
	`status` enum('draft','generating','complete','failed') NOT NULL DEFAULT 'draft',
	`directorsPackage` json,
	`cinematiquePrompt` text,
	`ticketSlug` varchar(64),
	`isPublic` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `concerts_ticketSlug_unique` UNIQUE(`ticketSlug`)
);
--> statement-breakpoint
CREATE TABLE `expert_council_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`concertId` int NOT NULL,
	`userId` int NOT NULL,
	`inputParams` json,
	`generatedPrompt` text,
	`directorsPackage` json,
	`modelUsed` varchar(128),
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expert_council_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `strawberryRiffProfile` varchar(255);
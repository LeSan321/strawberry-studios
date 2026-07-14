CREATE TABLE `music_video_audio_structure` (
	`id` int AUTO_INCREMENT NOT NULL,
	`musicVideoId` int NOT NULL,
	`tempoBpm` int,
	`beatGridJson` json,
	`sectionsJson` json,
	`energyEnvelopeJson` json,
	`analyzedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_video_audio_structure_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_video_audio_structure_musicVideoId_unique` UNIQUE(`musicVideoId`)
);
--> statement-breakpoint
CREATE TABLE `music_video_characters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`musicVideoId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`referenceImageUrl` text,
	`referenceImageKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_video_characters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `music_video_shots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`musicVideoId` int NOT NULL,
	`shotIndex` int NOT NULL,
	`segmentType` enum('intro','verse','chorus','bridge','outro','instrumental','other') NOT NULL DEFAULT 'verse',
	`startTimeSeconds` int NOT NULL DEFAULT 0,
	`targetDurationSeconds` int NOT NULL DEFAULT 5,
	`description` text,
	`cameraMovement` varchar(128),
	`lightingNote` text,
	`characterIds` json,
	`needsLipSync` boolean NOT NULL DEFAULT false,
	`transitionIn` enum('cut','dissolve','luma') NOT NULL DEFAULT 'cut',
	`provider` varchar(64) DEFAULT 'runway',
	`providerDurationSeconds` int,
	`videoPrompt` text,
	`shotVideoStatus` enum('pending','queued','generating','complete','failed') NOT NULL DEFAULT 'pending',
	`videoUrl` text,
	`videoJobId` varchar(255),
	`videoError` text,
	`progress` int DEFAULT 0,
	`lipSyncStatus` enum('not_needed','pending','complete','failed') NOT NULL DEFAULT 'not_needed',
	`lipSyncedVideoUrl` text,
	`lipSyncJobId` varchar(255),
	`lipSyncError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_video_shots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `music_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`audioTrackId` int,
	`title` varchar(255) NOT NULL,
	`artistName` varchar(255),
	`lyrics` text,
	`genreDescription` text,
	`durationSeconds` int,
	`musicVideoStatus` enum('draft','analyzing_audio','planning','awaiting_review','generating_shots','lip_syncing','assembling','complete','failed') NOT NULL DEFAULT 'draft',
	`storyboardJson` json,
	`errorMessage` text,
	`finalVideoUrl` text,
	`finalVideoKey` varchar(512),
	`projectFileUrl` text,
	`projectFileKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`finalizedAt` timestamp,
	CONSTRAINT `music_videos_id` PRIMARY KEY(`id`)
);

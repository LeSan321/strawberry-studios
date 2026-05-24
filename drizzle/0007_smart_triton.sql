CREATE TABLE `creator_frequencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`frequencyName` varchar(100) NOT NULL,
	`arcType` enum('expansive_mythic','witnessing_lateral','intimate_relational','sustained_ambient','erosive_revelatory','cyclical_return') NOT NULL DEFAULT 'expansive_mythic',
	`vocabularyJson` json NOT NULL,
	`synthesisFingerprint` text,
	`diagnosticAnswersJson` json,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_frequencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_default_vocabulary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vocabularyJson` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_default_vocabulary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `arcPosition` enum('gathering','arriving','open') DEFAULT 'arriving' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `frequencyId` int;
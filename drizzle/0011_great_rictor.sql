CREATE TABLE `cover_art_adaptive_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`signalWeights` json NOT NULL,
	`domainWeights` json NOT NULL,
	`generationsSinceLastAdaptation` int NOT NULL DEFAULT 0,
	`totalGenerations` int NOT NULL DEFAULT 0,
	`lastAdaptedAt` bigint,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cover_art_adaptive_weights_id` PRIMARY KEY(`id`),
	CONSTRAINT `cover_art_adaptive_weights_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cover_art_generation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`arc` enum('gathering','arriving','open') NOT NULL,
	`lifeSignalIds` json NOT NULL,
	`lifeSignalIntensityTotal` int NOT NULL DEFAULT 0,
	`qaScores` json NOT NULL,
	`timestamp` bigint NOT NULL,
	CONSTRAINT `cover_art_generation_logs_id` PRIMARY KEY(`id`)
);

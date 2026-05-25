ALTER TABLE `users` ADD `riffUserId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_riffUserId_unique` UNIQUE(`riffUserId`);
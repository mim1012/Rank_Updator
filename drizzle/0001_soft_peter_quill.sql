CREATE TABLE `bots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(50) NOT NULL,
	`deviceModel` varchar(100),
	`role` enum('leader','follower','rank_checker') NOT NULL,
	`groupId` int,
	`status` enum('online','offline','error') NOT NULL DEFAULT 'offline',
	`lastActivity` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bots_id` PRIMARY KEY(`id`),
	CONSTRAINT `bots_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`platform` enum('naver','coupang') NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`productId` varchar(100) NOT NULL,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'paused',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rankings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`rank` int NOT NULL,
	`reliabilityScore` int,
	`isSignificant` int DEFAULT 0,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rankings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `variable_combinations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variables` text NOT NULL,
	`status` enum('new','testing','elite','significant','deprecated') NOT NULL DEFAULT 'new',
	`generation` int NOT NULL DEFAULT 0,
	`performanceScore` int DEFAULT 0,
	`avgRank` int,
	`successRate` int,
	`captchaAvoidRate` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `variable_combinations_id` PRIMARY KEY(`id`)
);

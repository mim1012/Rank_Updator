CREATE TYPE "public"."bot_role" AS ENUM('leader', 'follower', 'rank_checker');--> statement-breakpoint
CREATE TYPE "public"."bot_status" AS ENUM('online', 'offline', 'error');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('naver', 'coupang');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."variable_status" AS ENUM('new', 'testing', 'elite', 'significant', 'deprecated');--> statement-breakpoint
CREATE TABLE "bots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"deviceId" varchar(50) NOT NULL,
	"deviceModel" varchar(100),
	"role" "bot_role" NOT NULL,
	"groupId" integer,
	"status" "bot_status" DEFAULT 'offline' NOT NULL,
	"lastActivity" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bots_deviceId_unique" UNIQUE("deviceId")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"platform" "platform" NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"productId" varchar(100) NOT NULL,
	"status" "campaign_status" DEFAULT 'paused' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rankings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campaignId" integer NOT NULL,
	"rank" integer NOT NULL,
	"reliabilityScore" integer,
	"isSignificant" integer DEFAULT 0,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "variable_combinations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variable_combinations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"variables" text NOT NULL,
	"status" "variable_status" DEFAULT 'new' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"performanceScore" integer DEFAULT 0,
	"avgRank" integer,
	"successRate" integer,
	"captchaAvoidRate" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

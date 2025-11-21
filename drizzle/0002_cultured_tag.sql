CREATE TABLE "experimentProducts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "experimentProducts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"productName" text NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"sourceUrl" text,
	"position" integer,
	"productId" varchar(100),
	"isUsed" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

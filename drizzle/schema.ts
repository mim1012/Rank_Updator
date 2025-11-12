import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

// Enums for PostgreSQL
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const platformEnum = pgEnum("platform", ["naver", "coupang"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["active", "paused", "completed"]);
export const botRoleEnum = pgEnum("bot_role", ["leader", "follower", "rank_checker"]);
export const botStatusEnum = pgEnum("bot_status", ["online", "offline", "error"]);
export const variableStatusEnum = pgEnum("variable_status", ["new", "testing", "elite", "significant", "deprecated"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: platformEnum("platform").notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  productId: varchar("productId", { length: 100 }).notNull(),
  status: campaignStatusEnum("status").default("paused").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// Bots table
export const bots = pgTable("bots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  deviceId: varchar("deviceId", { length: 50 }).notNull().unique(),
  deviceModel: varchar("deviceModel", { length: 100 }),
  role: botRoleEnum("role").notNull(),
  groupId: integer("groupId"),
  status: botStatusEnum("status").default("offline").notNull(),
  lastActivity: timestamp("lastActivity").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;

// Variable Combinations table
export const variableCombinations = pgTable("variable_combinations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  variables: text("variables").notNull(), // JSON string
  status: variableStatusEnum("status").default("new").notNull(),
  generation: integer("generation").default(0).notNull(),
  performanceScore: integer("performanceScore").default(0), // Store as integer (score * 10000)
  avgRank: integer("avgRank"),
  successRate: integer("successRate"), // Store as integer (rate * 100)
  captchaAvoidRate: integer("captchaAvoidRate"), // Store as integer (rate * 100)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VariableCombination = typeof variableCombinations.$inferSelect;
export type InsertVariableCombination = typeof variableCombinations.$inferInsert;

// Rankings table
export const rankings = pgTable("rankings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  campaignId: integer("campaignId").notNull(),
  rank: integer("rank").notNull(),
  reliabilityScore: integer("reliabilityScore"), // Store as integer (score * 100)
  isSignificant: integer("isSignificant").default(0), // 0 or 1 for boolean
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Ranking = typeof rankings.$inferSelect;
export type InsertRanking = typeof rankings.$inferInsert;

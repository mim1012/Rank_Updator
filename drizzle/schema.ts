import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Campaigns table
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["naver", "coupang"]).notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  productId: varchar("productId", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("paused").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// Bots table
export const bots = mysqlTable("bots", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 50 }).notNull().unique(),
  deviceModel: varchar("deviceModel", { length: 100 }),
  role: mysqlEnum("role", ["leader", "follower", "rank_checker"]).notNull(),
  groupId: int("groupId"),
  status: mysqlEnum("status", ["online", "offline", "error"]).default("offline").notNull(),
  lastActivity: timestamp("lastActivity").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;

// Variable Combinations table
export const variableCombinations = mysqlTable("variable_combinations", {
  id: int("id").autoincrement().primaryKey(),
  variables: text("variables").notNull(), // JSON string
  status: mysqlEnum("status", ["new", "testing", "elite", "significant", "deprecated"]).default("new").notNull(),
  generation: int("generation").default(0).notNull(),
  performanceScore: int("performanceScore").default(0), // Store as integer (score * 10000)
  avgRank: int("avgRank"),
  successRate: int("successRate"), // Store as integer (rate * 100)
  captchaAvoidRate: int("captchaAvoidRate"), // Store as integer (rate * 100)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VariableCombination = typeof variableCombinations.$inferSelect;
export type InsertVariableCombination = typeof variableCombinations.$inferInsert;

// Rankings table
export const rankings = mysqlTable("rankings", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  rank: int("rank").notNull(),
  reliabilityScore: int("reliabilityScore"), // Store as integer (score * 100)
  isSignificant: int("isSignificant").default(0), // 0 or 1 for boolean
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Ranking = typeof rankings.$inferSelect;
export type InsertRanking = typeof rankings.$inferInsert;
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
export const taskStatusEnum = pgEnum("task_status", ["pending", "running", "completed", "failed"]);
export const logLevelEnum = pgEnum("log_level", ["info", "warning", "error"]);

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

// Tasks table (10 variables from Zero API)
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  campaignId: integer("campaignId").notNull(),
  keywordId: integer("keywordId"),
  trafficId: integer("trafficId"),

  // 10 variables (Zero API format)
  uaChange: integer("uaChange").notNull().default(1),
  cookieHomeMode: integer("cookieHomeMode").notNull().default(1),
  shopHome: integer("shopHome").notNull().default(1),
  useNid: integer("useNid").notNull().default(0),
  useImage: integer("useImage").notNull().default(1),
  workType: integer("workType").notNull().default(3),
  randomClickCount: integer("randomClickCount").notNull().default(2),
  workMore: integer("workMore").notNull().default(1),
  secFetchSiteMode: integer("secFetchSiteMode").notNull().default(1),
  lowDelay: integer("lowDelay").notNull().default(2),

  // Status and results
  status: taskStatusEnum("status").default("pending").notNull(),
  rank: integer("rank"),
  errorMessage: text("errorMessage"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// Task Logs table (for debugging and monitoring)
export const taskLogs = pgTable("taskLogs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  taskId: integer("taskId").notNull(),
  level: logLevelEnum("level").default("info").notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskLog = typeof taskLogs.$inferSelect;
export type InsertTaskLog = typeof taskLogs.$inferInsert;

// Naver Cookies table (cookie pool management)
export const naverCookies = pgTable("naverCookies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nnb: varchar("nnb", { length: 255 }).notNull(),
  nidAut: varchar("nidAut", { length: 255 }),
  nidSes: varchar("nidSes", { length: 255 }),
  nidJkl: varchar("nidJkl", { length: 255 }),
  isActive: integer("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NaverCookie = typeof naverCookies.$inferSelect;
export type InsertNaverCookie = typeof naverCookies.$inferInsert;

// Experiment Products table (for 100 Work Type Experiment)
export const experimentProducts = pgTable("experimentProducts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productName: text("productName").notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  sourceUrl: text("sourceUrl"),
  position: integer("position"), // Rank position where found (around 200th)
  productId: varchar("productId", { length: 100 }), // Naver product ID if available
  isUsed: integer("isUsed").default(0).notNull(), // 0 = not used, 1 = used in experiment
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExperimentProduct = typeof experimentProducts.$inferSelect;
export type InsertExperimentProduct = typeof experimentProducts.$inferInsert;

/**
 * Campaign Router
 *
 * Manages campaigns with Zero API integration
 * Based on IMPLEMENTATION_PLAN.md Phase 4
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { campaigns, tasks } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { ZeroApiClient } from "../services/zeroApiClient";

export const campaignRouter = router({
  /**
   * Create a new campaign
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        platform: z.enum(["naver", "coupang"]),
        keyword: z.string().min(1).max(255),
        productId: z.string().min(1).max(100),

        // 10 variables (optional, with defaults)
        uaChange: z.number().int().min(0).max(1).default(1),
        cookieHomeMode: z.number().int().min(0).max(2).default(1),
        shopHome: z.number().int().min(0).max(4).default(1),
        useNid: z.number().int().min(0).max(1).default(0),
        useImage: z.number().int().min(0).max(1).default(1),
        workType: z.number().int().min(1).max(4).default(3),
        randomClickCount: z.number().int().min(0).max(10).default(2),
        workMore: z.number().int().min(0).max(1).default(1),
        secFetchSiteMode: z.number().int().min(0).max(2).default(1),
        lowDelay: z.number().int().min(1).max(10).default(2),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [campaign] = await db
        .insert(campaigns)
        .values({
          name: input.name,
          platform: input.platform,
          keyword: input.keyword,
          productId: input.productId,
          status: "paused", // Start paused, user must explicitly start
        })
        .returning();

      return campaign;
    }),

  /**
   * List all campaigns
   */
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }),

  /**
   * Get campaign details
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Get related tasks
      const campaignTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.campaignId, input.id))
        .orderBy(desc(tasks.createdAt));

      return {
        ...campaign,
        tasks: campaignTasks,
        taskStats: {
          total: campaignTasks.length,
          pending: campaignTasks.filter((t) => t.status === "pending").length,
          running: campaignTasks.filter((t) => t.status === "running").length,
          completed: campaignTasks.filter((t) => t.status === "completed").length,
          failed: campaignTasks.filter((t) => t.status === "failed").length,
        },
      };
    }),

  /**
   * Start a campaign
   *
   * Fetches keywords from Zero API and creates tasks
   */
  start: publicProcedure
    .input(
      z.object({
        id: z.number(),
        loginId: z.string().default("rank2"),
        imei: z.string().default("123456789012345"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify campaign exists
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Create Zero API client
      const zeroApi = new ZeroApiClient(input.loginId, input.imei);

      // Fetch keywords from Zero API
      const keywordData = await zeroApi.getKeywordsForRankCheck();

      // Create tasks from keyword data
      const createdTasks = [];
      for (const item of keywordData.data) {
        const [task] = await db
          .insert(tasks)
          .values({
            campaignId: campaign.id,
            keywordId: item.keyword_id,
            trafficId: item.traffic_id,
            uaChange: item.ua_change,
            cookieHomeMode: item.cookie_home_mode,
            shopHome: item.shop_home,
            useNid: item.use_nid,
            useImage: item.use_image,
            workType: item.work_type,
            randomClickCount: item.random_click_count,
            workMore: item.work_more,
            secFetchSiteMode: item.sec_fetch_site_mode,
            lowDelay: item.low_delay,
            status: "pending",
          })
          .returning();

        createdTasks.push(task);
      }

      // Update campaign status to active
      await db
        .update(campaigns)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(campaigns.id, input.id));

      return {
        success: true,
        taskCount: createdTasks.length,
        tasks: createdTasks,
      };
    }),

  /**
   * Pause a campaign
   */
  pause: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(campaigns)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(campaigns.id, input.id));

      return { success: true };
    }),

  /**
   * Resume a paused campaign
   */
  resume: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(campaigns)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(campaigns.id, input.id));

      return { success: true };
    }),

  /**
   * Complete a campaign
   */
  complete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaigns.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a campaign
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete campaign (tasks will cascade delete if FK is set)
      await db.delete(campaigns).where(eq(campaigns.id, input.id));

      return { success: true };
    }),

  /**
   * Get campaign statistics
   */
  stats: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      const campaignTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.campaignId, input.id));

      const completedTasks = campaignTasks.filter((t) => t.status === "completed");
      const foundRanks = completedTasks.filter((t) => t.rank && t.rank > 0);

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        totalTasks: campaignTasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: campaignTasks.filter((t) => t.status === "pending").length,
        runningTasks: campaignTasks.filter((t) => t.status === "running").length,
        failedTasks: campaignTasks.filter((t) => t.status === "failed").length,
        averageRank: foundRanks.length > 0
          ? Math.round(
              foundRanks.reduce((sum, t) => sum + (t.rank || 0), 0) / foundRanks.length
            )
          : null,
        bestRank: foundRanks.length > 0
          ? Math.min(...foundRanks.map((t) => t.rank || Infinity))
          : null,
        successRate:
          completedTasks.length > 0
            ? Math.round((foundRanks.length / completedTasks.length) * 100)
            : 0,
      };
    }),
});

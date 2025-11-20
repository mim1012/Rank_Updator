/**
 * Task Router
 *
 * Manages task execution, monitoring, and logging
 * Based on IMPLEMENTATION_PLAN.md Phase 6
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { tasks, campaigns, taskLogs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { ZeroApiClient, KeywordItem } from "../services/zeroApiClient";
import { createNaverBot } from "../services/naverBot";

export const taskRouter = router({
  /**
   * List tasks for a campaign
   */
  list: publicProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return db
        .select()
        .from(tasks)
        .where(eq(tasks.campaignId, input.campaignId))
        .orderBy(desc(tasks.createdAt));
    }),

  /**
   * Get task details
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);

      if (!task) {
        throw new Error("Task not found");
      }

      // Get related logs
      const logs = await db
        .select()
        .from(taskLogs)
        .where(eq(taskLogs.taskId, input.id))
        .orderBy(desc(taskLogs.createdAt));

      return {
        ...task,
        logs,
      };
    }),

  /**
   * Execute a task
   *
   * Main workflow:
   * 1. Update task status to running
   * 2. Create logs
   * 3. Initialize bot
   * 4. Check rank
   * 5. Report to Zero API
   * 6. Update task status
   */
  execute: publicProcedure
    .input(
      z.object({
        id: z.number(),
        loginId: z.string().default("rank2"),
        imei: z.string().default("123456789012345"),
        usePuppeteer: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Fetch task
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);

      if (!task) {
        throw new Error("Task not found");
      }

      // 2. Fetch campaign
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, task.campaignId))
        .limit(1);

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // 3. Update task status to running
      await db
        .update(tasks)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(tasks.id, input.id));

      // 4. Log start
      await db.insert(taskLogs).values({
        taskId: task.id,
        level: "info",
        message: "작업 시작",
        metadata: JSON.stringify({ campaignId: campaign.id }),
      });

      try {
        // 5. Create Zero API client
        const zeroApi = new ZeroApiClient(input.loginId, input.imei);

        // 6. Fetch keyword data (with 10 variables)
        let keywordData: KeywordItem;

        if (task.keywordId) {
          // If task has keywordId, it came from Zero API
          // Fetch fresh data
          const data = await zeroApi.getKeywordsForRankCheck();
          const item = data.data.find((k) => k.keyword_id === task.keywordId);

          if (!item) {
            throw new Error(`Keyword ${task.keywordId} not found in Zero API`);
          }

          keywordData = item;
        } else {
          // Manual task - construct KeywordItem from task data
          keywordData = {
            keyword_id: 0,
            search: campaign.keyword,
            product_id: campaign.productId,
            traffic_id: task.trafficId || 0,
            ua_change: task.uaChange,
            cookie_home_mode: task.cookieHomeMode,
            shop_home: task.shopHome,
            use_nid: task.useNid,
            use_image: task.useImage,
            work_type: task.workType,
            random_click_count: task.randomClickCount,
            work_more: task.workMore,
            sec_fetch_site_mode: task.secFetchSiteMode,
            low_delay: task.lowDelay,
          };
        }

        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: "키워드 데이터 로드 완료",
          metadata: JSON.stringify({
            keywordId: keywordData.keyword_id,
            keyword: keywordData.search,
          }),
        });

        // 7. Initialize bot
        const bot = await createNaverBot(input.usePuppeteer);

        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: `봇 초기화 완료 (${input.usePuppeteer ? "Puppeteer" : "HTTP"} 모드)`,
        });

        // 8. Check rank
        const rank = await bot.checkRank(task, campaign, keywordData);

        await bot.close();

        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: `순위 체크 완료: ${rank > 0 ? `${rank}위` : "순위 없음"}`,
          metadata: JSON.stringify({ rank }),
        });

        // 9. Report rank to Zero API
        if (rank > 0 && task.keywordId) {
          await zeroApi.updateKeywordRank(task.keywordId, rank, 0);

          await db.insert(taskLogs).values({
            taskId: task.id,
            level: "info",
            message: "Zero API에 순위 보고 완료",
          });
        }

        // 10. Finish keyword task (Zero API)
        if (task.keywordId && task.trafficId) {
          await zeroApi.finishKeyword(
            task.keywordId,
            task.trafficId,
            rank > 0 ? 0 : 1, // 0 = success, 1 = failed
            0 // work code
          );

          await db.insert(taskLogs).values({
            taskId: task.id,
            level: "info",
            message: "Zero API 작업 완료 처리",
          });
        }

        // 11. Update task status to completed
        await db
          .update(tasks)
          .set({
            status: "completed",
            rank: rank > 0 ? rank : null,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, input.id));

        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: "작업 완료",
        });

        return { success: true, rank };
      } catch (error) {
        // Error handling
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await db
          .update(tasks)
          .set({
            status: "failed",
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, input.id));

        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "error",
          message: `작업 실패: ${errorMessage}`,
          metadata: JSON.stringify({ error: errorMessage }),
        });

        throw error;
      }
    }),

  /**
   * Get task logs
   */
  logs: publicProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return db
        .select()
        .from(taskLogs)
        .where(eq(taskLogs.taskId, input.taskId))
        .orderBy(desc(taskLogs.createdAt));
    }),

  /**
   * Bulk execute tasks for a campaign
   */
  executeBulk: publicProcedure
    .input(
      z.object({
        campaignId: z.number(),
        loginId: z.string().default("rank2"),
        imei: z.string().default("123456789012345"),
        usePuppeteer: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch all pending tasks for campaign
      const pendingTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.campaignId, input.campaignId),
            eq(tasks.status, "pending")
          )
        );

      const results = [];

      // Execute tasks sequentially
      for (const task of pendingTasks) {
        try {
          const result = await this._def.procedures.execute.call({
            input: {
              id: task.id,
              loginId: input.loginId,
              imei: input.imei,
              usePuppeteer: input.usePuppeteer,
            },
            ctx: {} as any,
          });

          results.push({ taskId: task.id, success: true, rank: result.rank });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          results.push({ taskId: task.id, success: false, error: errorMessage });
        }
      }

      return {
        success: true,
        totalTasks: pendingTasks.length,
        results,
      };
    }),

  /**
   * Retry a failed task
   */
  retry: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Reset task status to pending
      await db
        .update(tasks)
        .set({
          status: "pending",
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id));

      await db.insert(taskLogs).values({
        taskId: input.id,
        level: "info",
        message: "작업 재시도 대기 중",
      });

      return { success: true };
    }),
});

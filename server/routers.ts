import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      // Temporary: Return dummy user for development without OAuth
      if (!opts.ctx.user) {
        return {
          id: 1,
          openId: "dev-user",
          name: "Development User",
          email: "dev@turafic.local",
          role: "admin" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        };
      }
      return opts.ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dashboard: router({
    getStats: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { totalBots: 0, onlineBots: 0, activeCampaigns: 0, errorCount: 0, recentActivities: [] };

      const { bots, campaigns } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const allBots = await db.select().from(bots);
      const allCampaigns = await db.select().from(campaigns);

      return {
        totalBots: allBots.length,
        onlineBots: allBots.filter(b => b.status === "online").length,
        activeCampaigns: allCampaigns.filter(c => c.status === "active").length,
        errorCount: allBots.filter(b => b.status === "error").length,
        recentActivities: [
          { id: 1, message: "캠페인 '갤럭시 S24' 시작", timestamp: new Date().toLocaleString() },
          { id: 2, message: "봇 'rank1' 온라인", timestamp: new Date().toLocaleString() },
        ],
      };
    }),
  }),

  campaigns: router({
    list: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];

      const { campaigns } = await import("../drizzle/schema");
      return await db.select().from(campaigns);
    }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "캠페인 이름은 필수입니다"),
        platform: z.enum(["naver", "coupang"]),
        keyword: z.string().min(1, "키워드는 필수입니다"),
        productId: z.string().min(1, "상품 ID는 필수입니다"),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { campaigns } = await import("../drizzle/schema");

        const [newCampaign] = await db.insert(campaigns).values({
          name: input.name,
          platform: input.platform,
          keyword: input.keyword,
          productId: input.productId,
          status: "paused",
        }).returning();

        return newCampaign;
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        platform: z.enum(["naver", "coupang"]).optional(),
        keyword: z.string().min(1).optional(),
        productId: z.string().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { campaigns } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const { id, ...updateData } = input;

        await db.update(campaigns)
          .set(updateData)
          .where(eq(campaigns.id, id));

        return { success: true, id };
      }),

    start: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { campaigns } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db.update(campaigns)
          .set({ status: "active" })
          .where(eq(campaigns.id, input.id));

        return { success: true, id: input.id, status: "active" };
      }),

    stop: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { campaigns } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db.update(campaigns)
          .set({ status: "paused" })
          .where(eq(campaigns.id, input.id));

        return { success: true, id: input.id, status: "paused" };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { campaigns } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db.delete(campaigns)
          .where(eq(campaigns.id, input.id));

        return { success: true, id: input.id };
      }),
  }),

  bots: router({
    list: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];

      const { bots } = await import("../drizzle/schema");
      return await db.select().from(bots);
    }),
  }),

  variableCombinations: router({
    list: publicProcedure
      .input(z.object({
        generation: z.number().optional(),
        status: z.enum(['new', 'testing', 'elite', 'significant', 'deprecated']).optional(),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];

        const { variableCombinations } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");

        let query = db.select().from(variableCombinations);

        // 필터 적용
        const conditions = [];
        if (input.generation !== undefined) {
          conditions.push(eq(variableCombinations.generation, input.generation));
        }
        if (input.status) {
          conditions.push(eq(variableCombinations.status, input.status));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }

        const combos = await query;

        return combos.map(c => ({
          ...c,
          score: c.performanceScore ? c.performanceScore / 10000 : 0,
          variablesParsed: JSON.parse(c.variables || "{}"),
        }));
      }),

    generateInitial: publicProcedure.mutation(async () => {
      const { generateInitialCombinations } = await import("./services/variableCombinations");
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { variableCombinations } = await import("../drizzle/schema");

      const combinations = generateInitialCombinations();
      await db.insert(variableCombinations).values(combinations);

      return { success: true, count: combinations.length };
    }),

    evolve: publicProcedure
      .input(z.object({
        generation: z.number(),
        populationSize: z.number().default(50),
      }))
      .mutation(async ({ input }) => {
        const { evolveGeneration } = await import("./services/variableCombinations");

        const nextGen = await evolveGeneration(input.generation, input.populationSize);

        return {
          success: true,
          generation: input.generation + 1,
          count: nextGen.length
        };
      }),

    updateMetrics: publicProcedure
      .input(z.object({
        id: z.number(),
        successRate: z.number().min(0).max(100),
        avgRank: z.number().min(1).max(100),
        captchaAvoidRate: z.number().min(0).max(100),
        consistencyScore: z.number().min(0).max(100),
      }))
      .mutation(async ({ input }) => {
        const { calculatePerformanceScore, classifyByPerformance } = await import("./services/variableCombinations");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { variableCombinations } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        // 성능 점수 계산
        const performanceScore = calculatePerformanceScore({
          successRate: input.successRate,
          avgRank: input.avgRank,
          captchaAvoidRate: input.captchaAvoidRate,
          consistencyScore: input.consistencyScore,
        });

        // 등급 분류 (임시로 testCount 10 사용)
        const status = classifyByPerformance(performanceScore, 10);

        // DB 업데이트
        await db
          .update(variableCombinations)
          .set({
            successRate: Math.round(input.successRate * 100),
            avgRank: input.avgRank,
            captchaAvoidRate: Math.round(input.captchaAvoidRate * 100),
            performanceScore,
            status,
          })
          .where(eq(variableCombinations.id, input.id));

        return { success: true, id: input.id, performanceScore, status };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { variableCombinations } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db.delete(variableCombinations).where(eq(variableCombinations.id, input.id));

        return { success: true, id: input.id };
      }),

    getGenerationStats: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];

      const { variableCombinations } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");

      // 세대별 통계 계산
      const stats = await db
        .select({
          generation: variableCombinations.generation,
          count: sql<number>`count(*)`,
          avgScore: sql<number>`avg(${variableCombinations.performanceScore})`,
          maxScore: sql<number>`max(${variableCombinations.performanceScore})`,
          eliteCount: sql<number>`sum(case when ${variableCombinations.status} = 'elite' then 1 else 0 end)`,
        })
        .from(variableCombinations)
        .groupBy(variableCombinations.generation)
        .orderBy(variableCombinations.generation);

      return stats.map(s => ({
        generation: s.generation,
        count: Number(s.count),
        avgScore: s.avgScore ? Number(s.avgScore) / 10000 : 0,
        maxScore: s.maxScore ? Number(s.maxScore) / 10000 : 0,
        eliteCount: Number(s.eliteCount),
      }));
    }),
  }),

  abTesting: router({
    getCombinations: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];

      const { variableCombinations } = await import("../drizzle/schema");
      const combos = await db.select().from(variableCombinations);

      return combos.map(c => ({
        ...c,
        score: c.performanceScore ? c.performanceScore / 10000 : 0,
        variableString: JSON.parse(c.variables || "{}"),
      }));
    }),
    getGenerations: publicProcedure.query(async () => {
      return [
        { number: 4, progress: 85, bestScore: 0.92 },
      ];
    }),
  }),

  rankings: router({
    getHistory: publicProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];

      const { rankings } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      return await db.select().from(rankings).where(eq(rankings.campaignId, 1));
    }),
  }),

  // 순위 체크 APK용 API
  rankCheck: router({
    // 1. 봇 등록
    registerBot: publicProcedure
      .input(z.object({
        deviceId: z.string().min(1),
        deviceModel: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { registerBot } = await import("./services/rankCheckService");
        const botId = await registerBot(
          input.deviceId,
          input.deviceModel || "Unknown"
        );

        if (!botId) {
          throw new Error("Failed to register bot");
        }

        return { success: true, botId };
      }),

    // 2. 작업 요청 (APK → 서버)
    getTask: publicProcedure
      .input(z.object({
        botId: z.number(),
        loginId: z.string(),
        imei: z.string(),
      }))
      .query(async ({ input }) => {
        const { assignTask } = await import("./services/rankCheckService");
        const task = await assignTask(input.botId, input.loginId, input.imei);

        if (!task) {
          return { success: false, message: "No tasks available" };
        }

        return { success: true, task };
      }),

    // 3. 순위 보고 (APK → 서버)
    reportRank: publicProcedure
      .input(z.object({
        taskId: z.string(),
        campaignId: z.number(),
        rank: z.number(),
        timestamp: z.string().transform(str => new Date(str)),
        success: z.boolean(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { reportRank } = await import("./services/rankCheckService");

        const success = await reportRank({
          taskId: input.taskId,
          campaignId: input.campaignId,
          rank: input.rank,
          timestamp: input.timestamp,
          success: input.success,
          errorMessage: input.errorMessage,
        });

        return { success };
      }),

    // 4. 작업 완료 (APK → 서버)
    finishTask: publicProcedure
      .input(z.object({
        taskId: z.string(),
        botId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { finishTask } = await import("./services/rankCheckService");
        const success = await finishTask(input.taskId, input.botId);

        return { success };
      }),

    // 5. 봇 상태 업데이트
    updateBotStatus: publicProcedure
      .input(z.object({
        botId: z.number(),
        status: z.enum(["online", "offline", "error"]),
      }))
      .mutation(async ({ input }) => {
        const { updateBotStatus } = await import("./services/rankCheckService");
        const success = await updateBotStatus(input.botId, input.status);

        return { success };
      }),
  }),
});

export type AppRouter = typeof appRouter;

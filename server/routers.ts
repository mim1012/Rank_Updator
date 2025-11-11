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
        }).$returningId();

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
});

export type AppRouter = typeof appRouter;

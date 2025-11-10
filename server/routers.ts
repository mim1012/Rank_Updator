import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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

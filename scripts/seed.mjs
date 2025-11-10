import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { campaigns, bots, variableCombinations, rankings } from "../drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

async function seed() {
  try {
    console.log("🌱 Seeding database...");

    // Insert campaigns
    await db.insert(campaigns).values([
      {
        name: "갤럭시 S24 순위 상승",
        platform: "naver",
        keyword: "갤럭시 S24",
        productId: "12345678",
        status: "active",
      },
      {
        name: "아이폰 15 프로 캠페인",
        platform: "naver",
        keyword: "아이폰 15 프로",
        productId: "87654321",
        status: "paused",
      },
      {
        name: "에어팟 프로 2세대",
        platform: "coupang",
        keyword: "에어팟 프로",
        productId: "99887766",
        status: "active",
      },
    ]);
    console.log("✅ Campaigns seeded");

    // Insert bots
    const botData = [];

    // Traffic bot groups (6 groups, each with 1 leader + 2 followers)
    for (let i = 1; i <= 6; i++) {
      // Leader bot
      botData.push({
        deviceId: `leader${i}`,
        deviceModel: "Galaxy S7",
        role: "leader",
        groupId: i,
        status: i <= 5 ? "online" : "offline",
      });

      // Follower bots
      for (let j = 1; j <= 2; j++) {
        botData.push({
          deviceId: `follower${i}_${j}`,
          deviceModel: "Galaxy S7",
          role: "follower",
          groupId: i,
          status: i <= 5 ? "online" : "offline",
        });
      }
    }

    // Rank checker bots
    for (let i = 1; i <= 4; i++) {
      botData.push({
        deviceId: `rank${i}`,
        deviceModel: "Galaxy S7",
        role: "rank_checker",
        groupId: null,
        status: "online",
      });
    }

    await db.insert(bots).values(botData);
    console.log("✅ Bots seeded");

    // Insert variable combinations
    await db.insert(variableCombinations).values([
      {
        variables: JSON.stringify({
          user_agent: "UA58",
          cw_mode: "CW해제",
          start_page: "쇼핑DI",
          cookie_strategy: "로그인쿠키",
          image_loading: "이미지패스",
          input_method: "복붙",
          scroll_count: "6랜",
          more_button: "더보기패스",
          x_requested_with: "x-with삼성",
          delay_strategy: "딜레이감소",
        }),
        status: "elite",
        generation: 4,
        performanceScore: 9200, // 0.92 * 10000
        avgRank: 45,
        successRate: 10000, // 100%
        captchaAvoidRate: 10000, // 100%
      },
      {
        variables: JSON.stringify({
          user_agent: "UA58",
          cw_mode: "CW1",
          start_page: "쇼핑DI",
          cookie_strategy: "로그인쿠키",
          image_loading: "이미지패스",
          input_method: "복붙",
          scroll_count: "6랜",
          more_button: "더보기패스",
          x_requested_with: "x-with크롬",
          delay_strategy: "딜레이기본",
        }),
        status: "elite",
        generation: 4,
        performanceScore: 9000, // 0.90
        avgRank: 48,
        successRate: 10000,
        captchaAvoidRate: 9900,
      },
      {
        variables: JSON.stringify({
          user_agent: "UA110",
          cw_mode: "CW1",
          start_page: "모통홈",
          cookie_strategy: "모통홈쿠키",
          image_loading: "이미지적용",
          input_method: "타이핑",
          scroll_count: "5랜",
          more_button: "더보기클릭",
          x_requested_with: "x-with크롬",
          delay_strategy: "딜레이기본",
        }),
        status: "significant",
        generation: 3,
        performanceScore: 7200, // 0.72
        avgRank: 65,
        successRate: 9500,
        captchaAvoidRate: 9800,
      },
    ]);
    console.log("✅ Variable combinations seeded");

    // Insert rankings
    const rankingData = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      rankingData.push({
        campaignId: 1,
        rank: 80 - Math.floor(i * 1.2) + Math.floor(Math.random() * 5),
        reliabilityScore: 8500 + Math.floor(Math.random() * 1000),
        isSignificant: i % 5 === 0 ? 1 : 0,
        timestamp,
      });
    }

    await db.insert(rankings).values(rankingData);
    console.log("✅ Rankings seeded");

    console.log("🎉 Seeding completed!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await connection.end();
  }
}

seed();

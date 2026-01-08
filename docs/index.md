# Rank_Updator Project Documentation Index

**Generated:** 2026-01-02
**Module Focus:** `rank-check/` (Rank Checking & Test Product Collection)
**Version:** 1.0

---

## 📋 Project Overview

**Type:** Backend/Library Module (within Full-Stack Web Application)
**Primary Language:** TypeScript
**Architecture:** Pipeline + Worker Pool Pattern

### Quick Reference

- **Module:** rank-check/
- **Tech Stack:** TypeScript, Puppeteer/Patchright, Supabase (PostgreSQL)
- **Entry Points:**
  - `rank-check/accurate-rank-checker.ts` (Core logic)
  - `rank-check/test/collect-test-products-by-range.ts` (Product collection)
  - `rank-check/batch/check-batch-worker-pool.ts` (Parallel processing)
- **Architecture Pattern:** Browser Automation Pipeline with API Intercept

---

## 📚 Generated Documentation

### Core Architecture

- **[Rank Check Module Architecture](./rank-check-module-architecture.md)**
  - 📐 System design and components
  - 🎯 Data flow and pipeline architecture
  - 🔧 Technology stack
  - 📊 Database schema
  - 🚨 Bot detection avoidance strategies

### Implementation Guides

- **[Test Product Collection Implementation Guide](./test-product-collection-implementation-guide.md)** ✅ **READY FOR IMPLEMENTATION**
  - 🚀 Step-by-step implementation
  - 💻 Complete code examples (copy-paste ready)
  - 🎯 300~400위권 수집 로직
  - 🧪 Testing and validation
  - 📊 Expected output examples

---

## 🗂️ Existing Documentation

### System Design & Integration

- [System Design](./SYSTEM_DESIGN.md) - Overall Turafic system architecture
- [Integration Summary](./INTEGRATION_SUMMARY.md) - Integration between components
- [Data Flow](./DATA_FLOW.md) - System-wide data flow
- [Variable Mapping](./VARIABLE_MAPPING.md) - Configuration variables

### Development & Operations

- [Developer Guide](./DEVELOPER_GUIDE.md) - Development setup and guidelines
- [Database Setup](./DATABASE_SETUP.md) - PostgreSQL/Supabase configuration
- [Runbook](./RUNBOOK.md) - Operational procedures
- [Testing Guide](./TESTING.md) - Testing strategies
- [Use Cases](./USE_CASES.md) - Common usage scenarios

### Technical Implementation

- [Final Solution](./FINAL_SOLUTION.md) - Final implementation details
- [HTTP Packet Implementation](./HTTP_PACKET_IMPLEMENTATION.md) - Network layer
- [Server HTTP Conclusion](./SERVER_HTTP_CONCLUSION.md) - Server architecture
- [Phase 3-7 Completion](./PHASE3-7_COMPLETION.md) - Development phases

### APIs & Reverse Engineering

- [Rank Check API](./api/RANK_CHECK_API.md) - API specifications
- [Reverse Engineering Requirements](./prd/reverse_engineering_requirements.md) - RE specs
- [Reverse Engineering Setup Guide](./reverse_engineering/setup_guide.md) - Frida setup
- [Windows Frida Setup](./reverse_engineering/windows_frida_setup.md) - Windows-specific

### Reports & Analysis

- [Bot Detection Bypass Report](./reports/2024-12-11-bot-detection-bypass.md) - Security analysis
- [Dashboard](./dashboard.md) - Real-time monitoring

---

## 🎯 Getting Started

### For Auto-Agent Implementation

**Goal:** 300~400위권 테스트 상품 자동 수집

1. **Read the Architecture Document**
   - Start: [Rank Check Module Architecture](./rank-check-module-architecture.md)
   - Understand: Pipeline architecture, data flow, bot avoidance

2. **Follow the Implementation Guide**
   - Guide: [Test Product Collection Implementation](./test-product-collection-implementation-guide.md)
   - Create: `rank-check/test/collect-test-products-by-range.ts`
   - Copy-paste: Complete working code provided

3. **Test and Validate**
   ```bash
   # Run collection
   npx tsx rank-check/test/collect-test-products-by-range.ts "장난감"

   # Verify results
   npx tsx rank-check/test/check-all-navertest-items.ts
   ```

4. **Extend and Customize**
   - Modify rank range (300-400 → custom)
   - Add multiple keyword batch processing
   - Integrate with tRPC API endpoints

### For Rank Checking

**Goal:** 특정 상품의 정확한 순위 체크

1. **Review Core Logic**
   - File: `rank-check/accurate-rank-checker.ts`
   - Function: `findAccurateRank(page, keyword, targetMid, maxPages)`

2. **Run Single Check**
   ```bash
   npx tsx rank-check/test/check-memo-items.ts
   ```

3. **Run Batch Check (Worker Pool)**
   ```bash
   npx tsx rank-check/test/check-batch-worker-pool-test.ts --workers=4
   ```

### For System Understanding

1. **Start with System Design**
   - Read: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)
   - Understand: Overall Turafic architecture

2. **Explore Integration**
   - Read: [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)
   - Understand: How rank-check integrates with server/client

3. **Check Data Flow**
   - Read: [DATA_FLOW.md](./DATA_FLOW.md)
   - Understand: Data movement through system

---

## 🔍 Quick Navigation

### By Task

| Task | Primary Document | Supporting Documents |
|------|-----------------|---------------------|
| **Implement product collection** | [Implementation Guide](./test-product-collection-implementation-guide.md) | [Architecture](./rank-check-module-architecture.md) |
| **Understand rank checking** | [Architecture](./rank-check-module-architecture.md) | [API Spec](./api/RANK_CHECK_API.md) |
| **Set up development** | [Developer Guide](./DEVELOPER_GUIDE.md) | [Database Setup](./DATABASE_SETUP.md) |
| **Deploy to production** | [Runbook](./RUNBOOK.md) | [System Design](./SYSTEM_DESIGN.md) |
| **Debug bot detection** | [Bot Detection Report](./reports/2024-12-11-bot-detection-bypass.md) | [Architecture](./rank-check-module-architecture.md) |
| **Understand overall system** | [System Design](./SYSTEM_DESIGN.md) | [Integration Summary](./INTEGRATION_SUMMARY.md) |

### By Component

| Component | Location | Documentation |
|-----------|----------|---------------|
| **Core Rank Checker** | `rank-check/accurate-rank-checker.ts` | [Architecture](./rank-check-module-architecture.md) |
| **Test Collection** | `rank-check/test/collect-test-products-by-range.ts` | [Implementation Guide](./test-product-collection-implementation-guide.md) |
| **Worker Pool** | `rank-check/batch/check-batch-worker-pool.ts` | [Architecture](./rank-check-module-architecture.md) |
| **Human Behavior** | `rank-check/utils/humanBehavior.ts` | [Architecture](./rank-check-module-architecture.md) |
| **Database Layer** | Supabase PostgreSQL | [Database Setup](./DATABASE_SETUP.md) |
| **API Endpoints** | `server/routers.ts` (tRPC) | [API Spec](./api/RANK_CHECK_API.md) |

---

## 📊 Project Statistics

- **Documentation Files:** 20+
- **Code Files (rank-check):** 22 TypeScript files
- **Test Scripts:** 7 test utilities
- **Core Functions:** 15+ rank checking functions
- **Supported Platforms:** m.naver.com (Mobile Shopping)
- **Max Rank Range:** 1~600위 (15 pages)

---

## 🚀 Next Steps

### Immediate Actions (For Auto-Agent)

1. ✅ Read architecture documentation
2. ✅ Review implementation guide
3. ⏳ Create `collect-test-products-by-range.ts` file
4. ⏳ Test with "장난감" keyword
5. ⏳ Verify results in Supabase
6. ⏳ Extend to multiple keywords

### Future Enhancements

- [ ] IP rotation and proxy support
- [ ] CAPTCHA solving (2Captcha API)
- [ ] Real-time progress dashboard
- [ ] Excel export functionality
- [ ] Scheduled batch collection (cron)
- [ ] Email/Slack notifications

---

## 📞 Support & Resources

### Key Files

- **Entry Point:** `rank-check/accurate-rank-checker.ts`
- **Test Collection:** `rank-check/test/collect-test-products-by-range.ts` _(To be generated)_
- **Batch Processing:** `rank-check/batch/check-batch-worker-pool.ts`
- **Configuration:** `.env` (Supabase credentials)

### Environment Setup

```env
# Required in .env file
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Useful Commands

```bash
# Install dependencies
pnpm install

# Run product collection (after implementation)
npx tsx rank-check/test/collect-test-products-by-range.ts "키워드"

# Check results
npx tsx rank-check/test/check-all-navertest-items.ts

# Run batch rank check
npx tsx rank-check/test/check-batch-worker-pool-test.ts --workers=4
```

---

**Document Generated:** 2026-01-02
**Generated By:** Claude Code (BMad Document-Project Workflow)
**Scan Level:** Quick Scan (Pattern-based)
**Focus:** rank-check module automation

**This index serves as the primary entry point for AI-assisted development of the rank-check module.**

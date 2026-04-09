# Company Knowledge Base — Snapshot 2026-04-08

> Auto-mined from Jira, Confluence, and meeting transcripts. This is the living knowledge base for the MCC panel.

---

## 1. Company Structure

### Organization: Upstars
- **Atlassian Instance**: upstars.atlassian.net
- **Staff**: ~60 active human users in Jira
- **Jira Projects**: 80+ projects, 140+ boards
- **Confluence Spaces**: 47 spaces

### Core Divisions (Media Buying / "Makeberry")

| Division | Jira Project | Board | Type | Key People |
|----------|-------------|-------|------|-----------|
| **Arbitrage Platform** | ASD (1,587 issues) | SCRUM MB AP (id:1022) | Scrum | Yaroslav Kuts (PO), Oleh Litvin, Tymofii Konopatov, Ivan Horbenko, Artem Zakharov, Oleksandr Filonenko, Vitalii Vorynka, Alina Tsariuk |
| **Funnel Space** | FS (510 issues) | MB FS (id:956) | Scrum | Dmytro Krutko (PO), Andrii Laptiev, Andrii Baria, Yevhenii Onoshko, Borys Rohulia, Yurii Pustovyi, Ruslan Kovalchuk, Vladyslav Shulzhenko, Yuliia Misiura |
| **MB Product (Roadmap)** | MP (69 issues) | MB Product Board (id:2520) | Scrum | Mykola Kandiuk (Head of Product) |
| **Analytics** | AN (5,000+ issues) | Doska AN (id:12) | Scrum | Weekly sprints |
| **MBA Space** | RS (219 issues) | Multiple kanban boards | Kanban | Conversion Analysis, Data Engineering, Core Analysis |
| **Innovation / Pixel** | PXL (849 issues) | Pixel Scrum (id:396) | Scrum | |
| **MB Infrastructure** | MIB | MIB board (id:1187) | Kanban | |
| **Mobile Dev** | AMD | Multiple boards | Kanban | |

### Leadership

| Person | Role | Jira Account |
|--------|------|-------------|
| **Alexander Pravdyvyi** | VP of Makeberry Production | ✅ |
| **Mykola Kandiuk** | Head of Product | ✅ (m.kandiuk@upstars.com) |
| **Oleksii Kosenko** | Head of Engineering / CTO | ✅ |
| **Serhii Vladov** | PM / Scrum Master (new hire) | ✅ |
| **Dmytro Krutko** | PO, Funnel Production | ✅ |
| **Yaroslav Kuts** | PO, Arbitrage Platform | ✅ |
| **Andrii Laptiev** | Frontend/Infra Lead | ✅ |

---

## 2. Active Sprints (as of 2026-04-08)

| Board | Sprint | Dates | Goal |
|-------|--------|-------|------|
| ASD (1022) | **MB AP 20** | Apr 1-15 | UI changes KM, Integration API Finance 2.0, Pre Alpha Finance 2.0 |
| FS (956) | **MB FS 05** | Apr 6-20 | Integration KT, Update analytics schema, Deploy AI LP generator, Update ID check logic |
| AN (12) | **DE Sprint 2026 W14** | Apr 6-13 | (no goal) |

---

## 3. Sprint Velocity (Historical)

### ASD — Arbitrage Platform
| Sprint | Dates | Issues | Done | Rate |
|--------|-------|--------|------|------|
| MB AP 19 | Mar 16 - Apr 1 | 87 | 53 | 61% |
| MB AP 18 | Feb 23 - Mar 16 | 113 | 96 | 85% |
| MB AP 17 | Feb 6 - Feb 23 | 122 | 112 | 92% |
| MB AP 16 | Jan 21 - Feb 6 | 94 | 78 | 83% |
| MB AP 15 | Jan 8 - Jan 21 | 89 | 78 | 88% |

**Avg velocity: ~83 done/sprint. Note: SP19 dropped to 61% — investigate.**
**No story points used — velocity measured by issue count only.**

### FS — Funnel Space
| Sprint | Dates | Issues | Done | Rate |
|--------|-------|--------|------|------|
| MB FS 04 | Mar 23 - Apr 6 | 75 | 66 | 88% |
| MB FS 03 | Feb 23 - Mar 20 | 85 | 80 | 94% |
| MB FS 02 | Feb 8 - Feb 23 | 55 | 53 | 96% |
| MB FS 01 | Jan 26 - Feb 6 | 27 | 24 | 89% |
| FS Sprint 10 | Jan 5 - Jan 26 | 32 | 28 | 88% |

**Avg velocity: ~50 done/sprint. Growing fast (27→75 issues/sprint over 3 months).**

---

## 4. Cycle Time (Last 30 Days)

| Metric | ASD | FS |
|--------|-----|-----|
| **Average** | 19.1 days | 14.6 days |
| **Median** | 13 days | 9 days |
| **P90** | 38 days | 29 days |
| **Max** | 202 days | 113 days |

**30-day throughput**: ASD=107, FS=96 (combined ~7/day)

---

## 5. Blocked Items (Risk Register)

**12 items blocked in ASD, 0 in FS/MP.**

⚠️ **Concentration risk**: Oleh Litvin owns 7 of 12 blocked items (all Finance 2.0).

Key blocked items:
- ASD-1582: Attribution issues in iOS apps (High)
- ASD-1456: Role permissions working incorrectly (High)
- ASD-1369: Dashboard access sharing between buyer teams (High, **unassigned**)

---

## 6. Active Epics (What's Being Built)

### FS — Funnel Space (15 active epics)
**In Progress:**
- Landing Manager v0.1 (FS-678) — Ruslan Kovalchuk
- FS Analytics Board (FS-322)
- Service ID Check (FS-310)
- Meta Mind FB extension (FS-491) — Andrii Laptiev (in Code Review)

**To Do (queued):**
- PWA push notifications (FS-150) — Dmytro Krutko
- Blocking management (FS-343)
- Install Flow & Deep Linking (FS-258)

### ASD — Arbitrage Platform (13 active epics)
- Finance 2.0 (ASD-694) — major effort, most of sprint work
- Keitaro Manager (ASD-1465)
- Creatives 2.0 (ASD-1479)
- Farm CRM (ASD-1478)
- Dashboard refactor (ASD-1511)
- Cloaks/Funnels/App Direct (ASD-915)
- Keitaro Funnels (ASD-333)

---

## 7. MP — Strategic Roadmap 2026 (7 Initiatives)

From Jira MP project (all labeled `roadmap-2026`):

| ID | Initiative | Key Epics | Status |
|----|-----------|-----------|--------|
| **I1** | Buyer decision quality & budget adherence (buyerops) | Houston Frontend v0.1-v1.2, Extension Ecosystem | Open |
| **I2** | Funnel conversion optimization | PWA Platform, Creative Service v2, OfferWall, Landing Service | Open |
| **I3** | Architecture modernization | K8s migration, Monitoring | Open |
| **I4** | Finance 2.0 | Finance phases | Open |
| **I5** | Funnel conversion (expanded) | PWA v2.0-v3.0, Creative v2.0-v2.3, OfferWall v1.0-v1.1 | Open |
| **I6** | Identity coverage for personalization | ID Service v0.1-v0.4 | Open |
| **I7** | ML-ready data foundation | Data Lake v0.1-v1.1, Extension Ecosystem v2.5-v3.0 | Open |

---

## 8. Houston V1.0 — Product Spec (from Confluence)

### Vision
Single operational system for media buying: `plan → fact → risk → decision → reallocation → control`

### Target Users
1. **Primary**: Head of Media Buying (controls budget + reallocation)
2. **Secondary**: Team Lead (maintains run-rate and CPA)
3. **Tertiary**: VP

### North Star Metric
**Operational margin / % of budget spent in "nowhere"**

### Core Value Metric
**Decision-to-Action Time** — target: <15 min from deviation detection to applied correction

### Houston Version Roadmap

| Version | Scope | Duration |
|---------|-------|----------|
| **v0.1** | Budget Distribution, Assignment & Fact Entry | 1.5 months |
| **v0.2** | CPA Tracking & Traffic Light Alerts | 0.5 months |
| **v0.3** | Plan/Fact Cascade by Hierarchy + Recommendations | 2 months |
| **v0.4** | Alerts | 1 month |
| **v0.5** | Kill Switch (Human in loop) | 2 months |
| **v1.0** | Kill Switch (Automated) | 2 months |
| **v1.1** | Autobuying (Human in loop) | 2 months |
| **v1.2** | Autobuying (Automated) | 2 months |

### CPA Traffic Light Thresholds
- 🟢 Green: CPA < 95% of target
- 🟡 Yellow: CPA 95-110% of target
- 🟡🔶 Orange: CPA 110-115% of target
- 🔴 Hard Stop: CPA > 115% of target

### Key KPI Targets
| Metric | Baseline | Target |
|--------|----------|--------|
| Budget Overrun Rate | 15-20% | <5% |
| Cycle Time (decision to action) | 48 hours | <4 hours |
| Time-to-Insight | 1-3 weeks | <1 day |

### Responsible
- **PO**: Mykola Kandiuk
- **Start**: April 2026
- **Finish target**: September 2026
- **FE Dev**: Dmytro

---

## 9. Key Confluence Documentation

### Makeberry Production Space (47 pages)

**Operational Manuals:**
- Створення PWA в Makeberry HUB
- Створення Funnel в Keitaro Manager
- Створення PWA в конструкторі Funnel Space
- Створення клоаки та лінки для заливу в Keitaro Manager

**Meta Mind (FB Extension):**
- Product Overview
- User Manual
- DataFlow (Buyer Guide)
- DataFlow (Team Lead Guide)
- Quick Fix guide
- Statistics & feedback analysis

**Finance:**
- Finance - BizDev (Makeberry Hub)
- Finance - Робота з витратами для команд
- Brocard - Admin/BizDev
- Brocard - Team Lead/Buyer

**Other:**
- Weekly Production Report Guidelines
- About Makeberry Production
- Offers Search Page Manual
- Makeberry Hub Documentation
- Caps Control manuals (BizDev + all teams)

### Upservice Space (Platform Architecture)
- **Структура**: Service → Applications → Permissions model
- Services: UpService, Funnels, Creatives, Helper, Event Manager
- Projects subscribe to Services, Teams get granular Application-level permissions
- Roles & permissions page
- Profile management

### Design Human-Centered Space
- Team structure: flexible/hybrid model
- Head of Design: Люся Гузенко
- Team Lead: Влад Кацовенко
- Designers assigned to THOR, ALPA, KING products

---

## 10. Current Buying Crisis (from Meeting Transcripts, 2026-04-08)

### Problems Identified
1. **Cloaking**: Primitive geo-only; FB killer crawlers bypass it
2. **White Pages**: Reused hundreds of times; FB has seen them all
3. **Account Health**: WebRTC leaks in Dolphin (~every 3-5 refreshes)
4. **iOS Performance**: PWAs convert worse than Android
5. **Event Streaming**: Single IP for all pixel events → linkage risk
6. **Funnel Migration**: Still on external BetterLink/Skycoin

### Action Items (from meetings)
- Test hox.tech cloaking service (Oleksii/Serhii Oliinyk)
- Get 1000+ white pages from Mitrofanov (Andrii Laptiev)
- Disable WebRTC at Dolphin profile level
- Set up 20+ server proxies for event streaming
- Direct buyer collaboration for testing (bypass VP process)
- Goal: 30% ban rate reduction

### Key Technical Working Group
- Oleksii Kosenko (lead), Serhii Oliinyk, Andrii Laptiev, Alexander Pravdyvyi, Serhii Poprovka, Yaroslav Kuts, Dmytro Omelchenko

---

## 11. Meta Mind — FB Extension (from Jira FS project)

Active issues in current sprint:
- FS-491: **[EPIC] Meta Mind FB extension** — Andrii Laptiev (Code Review)
- FS-694: **Data duplication in Meta Mind** — Bug, Yurii Pustovyi
- FS-693: **Missing data from Meta Mind in critical fields** — Bug, Yurii Pustovyi
- FS-692: **Research Meta Mind operating principles** — Yurii Pustovyi
- FS-691: **Data inconsistency between Meta Mind groups (1→2→3)** — Bug, Yurii Pustovyi

**Meta Mind is the internal FB account monitoring extension. Has documented Confluence pages for buyers/team leads. Currently has data quality issues being investigated.**

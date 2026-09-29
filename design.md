# Uptime Monitoring Tool — Design Document

> **Design direction:** Adapt the provided Dribbble reference into an uptime-monitoring product. The reference uses a polished SaaS dashboard with a persistent left sidebar, a light neutral workspace, rounded cards, compact metric rows, status pills, and dense but readable data tables. The product should feel operational, calm, and trustworthy rather than visually noisy.
>
> **Reference:** [Provided Dribbble image](https://cdn.dribbble.com/userupload/45743827/file/998d424ed934e752dc82832dac1f3fa7.png?resize=752x&vertical=center)

---

## 1. Product Overview

The product is a web-based **uptime and endpoint monitoring platform** for developers, SREs, platform teams, and small businesses.

It continuously checks monitored URLs/endpoints and reports:

- Availability / uptime percentage
- Response time and latency
- HTTP status code
- DNS timing
- TLS/SSL certificate health
- Redirect behavior
- Request failures and timeouts
- Regional or probe-level failures
- Incident history
- Alert and notification state

The primary design goal is to make the answer to **“Are my services healthy right now?”** immediately visible, while still giving users enough detail to diagnose a failure.

---

## 2. Design Principles

### 2.1 Status first
Health information must be understandable at a glance. Use restrained semantic color only for status:

- **Healthy:** green
- **Degraded / warning:** amber
- **Down / critical:** red
- **Unknown / paused:** gray

### 2.2 Dense, not cluttered
Monitoring products need high information density. Prefer compact rows, aligned metrics, clear hierarchy, and predictable spacing over large decorative sections.

### 2.3 Calm visual language
The interface should resemble the reference: soft gray page background, white surfaces, subtle borders, low-radius shadows, and modest corner rounding.

### 2.4 Progressive detail
The dashboard gives a summary first. Clicking a monitor opens deeper performance, timing, and incident details without overwhelming the initial view.

### 2.5 Fast scanning
A user should be able to answer these questions within a few seconds:

1. Is anything down?
2. Which monitor is unhealthy?
3. Since when?
4. What changed?
5. How slow is it?

---

## 3. Visual Direction From the Reference

The supplied reference suggests the following visual system:

- Persistent **left sidebar navigation**
- Rounded desktop application shell
- Light gray / off-white canvas
- White cards layered above the canvas
- Compact top toolbar
- Search field near the top-right
- Pill-style filters and status labels
- Metric groups displayed in a single horizontal row
- Data-heavy tables with generous row spacing
- Green/red/amber status indicators used sparingly
- Small utility actions such as refresh, export, and create
- Bottom-left account/profile area

### Suggested visual interpretation for this product

| Element | Direction |
|---|---|
| App background | Very light neutral gray |
| Main cards | White |
| Borders | Soft neutral gray |
| Primary text | Near-black / charcoal |
| Secondary text | Muted gray |
| Healthy | Green accent |
| Warning | Amber accent |
| Critical | Red accent |
| Accent | Blue-violet or indigo for active controls |
| Radius | 10–16px cards; 8–10px controls |
| Shadow | Very subtle, mostly elevation through border contrast |
| Typography | Modern sans-serif, medium-weight headings, compact body text |

---

## 4. Information Architecture

```text
Workspace
├── Overview
├── Monitors
│   ├── All monitors
│   ├── HTTP / HTTPS
│   ├── TCP
│   ├── DNS
│   └── Heartbeat
├── Incidents
├── Analytics
├── Alerting
│   ├── Notification channels
│   └── Alert rules
├── Status Pages
├── Team
└── Settings
```

The left navigation should stay visually similar to the reference: icon + label, active item in a soft highlighted capsule/row, and a user/profile section anchored at the bottom.

---

## 5. Main Dashboard — Overview

### Goal
Provide a complete operational snapshot without requiring navigation.

### Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: workspace | search | refresh | alerts | avatar │
├─────────┼──────────────────────────────────────────────────────────┤
│         │ Overview                                                │
│         │ “Monitor your services and endpoints”                   │
│         │                                                          │
│         │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│         │ │ 24     │ │ 23     │ │ 1      │ │ 99.98% │             │
│         │ │ Monitors││ Up     │ │ Down   │ │ Uptime │             │
│         │ └────────┘ └────────┘ └────────┘ └────────┘             │
│         │                                                          │
│         │ ┌───────────────────────────────┐ ┌───────────────────┐ │
│         │ │ Uptime / Response Time        │ │ Current incidents │ │
│         │ │ line / bar visualization      │ │ incident cards    │ │
│         │ └───────────────────────────────┘ └───────────────────┘ │
│         │                                                          │
│         │ ┌────────────────────────────────────────────────────┐ │
│         │ │ Monitors                                            │ │
│         │ │ Status | Monitor | Uptime | Latency | Last Check   │ │
│         │ │ rows...                                             │ │
│         │ └────────────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────────────┘
```

### Summary cards

1. **Total monitors**
2. **Operational monitors**
3. **Active incidents**
4. **Average / workspace uptime**
5. Optional secondary row: p95 latency, checks/minute, failed checks, monitors degraded

The cards should use the reference's compact metric-card treatment rather than oversized dashboard tiles.

---

## 6. Monitor List

This is the core operational page and should closely follow the reference's endpoint-list structure.

### Header

**Monitors**

Subtitle: `Monitor your services, APIs, websites and infrastructure endpoints.`

Actions:

- Refresh
- Export
- **+ New monitor**

### Filters

Use a compact filter row beneath the header:

- All
- Up
- Down
- Degraded
- Paused
- HTTP
- DNS
- TCP
- Heartbeat
- Region
- Search monitors

### Monitor row/card

Each monitor should expose the highest-value operational metrics without opening the detail screen.

| Column | Example |
|---|---|
| Status | ● Up |
| Monitor | Production API |
| URL / target | `api.example.com/health` |
| Uptime | `99.99%` |
| Avg latency | `82 ms` |
| P95 latency | `144 ms` |
| DNS | `18 ms` |
| HTTP | `200` |
| Last check | `12 sec ago` |
| Interval | `60 sec` |
| Region | `Mumbai` / `Global` |

### Optional card-style monitor block

For desktop widths, use wide cards similar to the reference where each monitor acts as a grouped record:

```text
GET /health        ● Up     v2.4.1                      ⋮
api.example.com
────────────────────────────────────────────────────────
Uptime       Requests      Avg latency    P95        DNS
99.99%       1.2M          82ms            144ms      18ms
────────────────────────────────────────────────────────
Last checked 12 sec ago     Interval 60 sec     Region Global
```

This pattern is especially useful if the product also tracks API endpoints.

---

## 7. Monitor Detail Page

### Header

```text
← Monitors

Production API                     ● Operational
https://api.example.com/health

[Check now] [Edit] [Pause] [⋮]
```

### Hero metrics

Show a compact metric row:

- Uptime
- Avg response time
- P95 response time
- Error rate
- Current status
- Last checked

### Main detail tabs

```text
Overview | Performance | Checks | Incidents | SSL | DNS | Settings
```

### Overview content

#### Uptime chart

Line/bar visualization over selectable time ranges:

- 1 hour
- 24 hours
- 7 days
- 30 days
- 90 days

The chart should visibly mark downtime incidents and recoveries.

#### Response-time chart

Plot average and p95 response times. Allow the user to hover a point and inspect:

- Timestamp
- Response time
- HTTP status
- Probe region
- Check result

#### Check timeline

A chronological event stream:

```text
16:22:14   ● 200   84ms   Mumbai
16:21:14   ● 200   79ms   Mumbai
16:20:14   ● 503   1.8s   Mumbai    ⚠ Failed
16:19:14   ● 200   81ms   Mumbai
```

---

## 8. Monitor Creation Flow

Use a clean modal or dedicated creation screen.

### Step 1 — Basic configuration

Fields:

- Monitor name
- URL / hostname / IP
- Monitor type
- Check interval
- Timeout

### Step 2 — Request settings

For HTTP/HTTPS:

- Method
- Headers
- Query parameters
- Request body
- Expected status codes
- Expected response text / JSON path (optional)

### Step 3 — Network timing

Optional measurements:

- DNS lookup
- TCP connect
- TLS handshake
- Time to first byte
- Total response time

### Step 4 — Locations

Select one or multiple probe regions.

Examples:

- Mumbai
- Singapore
- Frankfurt
- Virginia
- Sydney
- São Paulo

### Step 5 — Alerting

Define:

- Down after N failures
- Recovery notification
- Latency threshold
- SSL expiry threshold
- Notification channels

### Final action

**Create monitor**

Immediately run the first check after creation and show its result.

---

## 9. Incidents Page

The incident screen is the operational history of failures.

### Summary

- Active incidents
- Incidents in last 24h
- Mean time to recovery (MTTR)
- Total downtime

### Incident table

| Status | Monitor | Started | Duration | Cause | Impact |
|---|---|---|---|---|---|
| Active | Production API | 16:20 | 12m | HTTP 503 | High |
| Resolved | Web App | 11:42 | 3m | Timeout | Medium |

### Incident detail

Display a vertically structured timeline:

```text
Incident started
      ↓
3 consecutive failed checks
      ↓
Alert triggered
      ↓
Latency increased
      ↓
Service recovered
      ↓
Recovery notification sent
```

This should be highly scannable and visually consistent with the reference's compact data presentation.

---

## 10. Analytics

The analytics page should turn raw checks into trends.

### Key metrics

- Uptime %
- Downtime
- Average latency
- P95 latency
- P99 latency
- Error rate
- Failed checks
- SSL certificates expiring soon

### Views

**Availability**

- Daily uptime trend
- Incident count
- Downtime by monitor

**Performance**

- Average response time
- p95/p99
- Slowest endpoints

**Network timing**

- DNS latency
- TCP connection time
- TLS negotiation time
- Server response time

### Comparison

Allow selection of up to 5 monitors for side-by-side comparison.

---

## 11. Alerting UX

Alerting should be discoverable but never dominate the dashboard.

### Alert rule examples

```text
IF monitor is DOWN for 2 consecutive checks
→ send Slack + Email

IF p95 latency > 1000ms for 5 minutes
→ send Slack

IF SSL expires in < 14 days
→ send Email
```

### Notification channels

Support:

- Email
- Slack
- Discord
- Microsoft Teams
- Webhook
- PagerDuty / incident-management integrations (optional)

Each channel is represented by a small integration card with:

- Connected / Not connected status
- Last delivery
- Test notification action
- Edit / disconnect actions

---

## 12. Status Page

A public status page should use the same design language but be simpler.

### Example

```text
Acme Systems
All systems operational

● API                       Operational
● Website                   Operational
● Authentication            Operational
● Payments                  Operational

Past 90 days
────────────────────────────
████████████████████████████  99.99%

Recent incidents
No incidents in the last 30 days.
```

The status page must be readable without requiring authentication.

---

## 13. Navigation Design

The sidebar follows the reference closely.

### Top section

**Product / Workspace selector**

```text
◉ Acme Systems
   Pro • 24 monitors
```

### Main navigation

```text
▦ Overview
⌁ Monitors
◔ Incidents
◴ Analytics
♧ Alerting
▣ Status Pages
```

### Bottom section

```text
⚙ Settings

● Alex Kumar
   Workspace owner
```

A compact collapse control can reduce the sidebar to icons.

---

## 14. Header / Topbar

Use the reference's low-profile utility header.

### Left

Current page title and optional breadcrumb.

### Center/right

- Global search
- Refresh / last refreshed
- Notification bell
- Help
- User avatar

### Search behavior

Search should support:

- Monitor name
- URL
- IP / hostname
- Incident ID
- Status

Keyboard shortcut: `⌘K` / `Ctrl+K`.

---

## 15. Components

### Status badge

```text
● Operational
● Degraded
● Down
● Paused
```

### Metric pill

```text
99.99% uptime
82ms latency
200 HTTP
18ms DNS
```

### Trend indicator

```text
↑ 4.2% vs previous period
↓ 18ms vs previous period
```

### Compact action button

Primary: `+ New Monitor`

Secondary: `Refresh`, `Export`, `Check now`

Destructive: `Delete monitor`

### Empty state

Avoid large illustrations. Prefer concise operational guidance:

> **No monitors yet**
> Add your first endpoint and we'll start checking it immediately.
>
> **+ New monitor**

### Loading state

Use skeleton rows/cards that match the actual monitor layout instead of generic spinners.

---

## 16. Color Semantics

Do not use bright colors for decoration. Color communicates system state.

| State | Meaning | Usage |
|---|---|---|
| Green | Healthy | Up, recovered, successful check |
| Amber | Warning | Degraded, high latency, SSL expiring |
| Red | Critical | Down, repeated failures, certificate expired |
| Gray | Neutral | Paused, unknown, disabled |
| Accent | Interaction | Active nav, focus, links, selected filters |

Charts should remain mostly neutral, with status colors reserved for meaningful anomalies.

---

## 17. Responsive Design

### Desktop ≥ 1200px

- Persistent sidebar
- Multi-column metric area
- Full monitoring table
- Charts side-by-side where useful

### Tablet 768–1199px

- Collapsible sidebar
- 2-column metric cards
- Table becomes horizontally scrollable or switches to compact cards

### Mobile < 768px

- Sidebar becomes a drawer
- Bottom or top navigation for critical areas
- Metric cards become a 2-column grid
- Monitor rows become stacked cards
- Charts become horizontally scrollable
- Primary CTA remains sticky when creating/editing a monitor

The product should prioritize **status → incident → monitor detail** in that order on mobile.

---

## 18. Accessibility

- All status states must have text labels, not color alone.
- Provide keyboard navigation for all actions.
- Use visible focus states.
- Ensure charts include accessible summaries or data tables.
- Buttons must have clear accessible names.
- Maintain readable contrast for muted text.
- Do not rely on tiny status icons as the only signal.

---

## 19. Suggested Data Model

### Monitor

```ts
interface Monitor {
  id: string;
  name: string;
  type: 'http' | 'https' | 'tcp' | 'dns' | 'heartbeat';
  target: string;
  method?: string;
  intervalSeconds: number;
  timeoutMs: number;
  status: 'up' | 'degraded' | 'down' | 'paused' | 'unknown';
  uptime30d: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  lastCheckAt: string;
  createdAt: string;
}
```

### Check result

```ts
interface CheckResult {
  id: string;
  monitorId: string;
  checkedAt: string;
  success: boolean;
  statusCode?: number;
  latencyMs?: number;
  dnsMs?: number;
  tcpMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
  region: string;
  error?: string;
}
```

### Incident

```ts
interface Incident {
  id: string;
  monitorId: string;
  status: 'active' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  durationSeconds?: number;
  cause?: string;
}
```

---

## 20. Backend / Monitoring Architecture

```text
                ┌──────────────────────┐
                │      Web Dashboard   │
                └──────────┬───────────┘
                           │ API
                ┌──────────▼───────────┐
                │    Application API   │
                │ auth / CRUD / alerts │
                └───────┬───────┬──────┘
                        │       │
              ┌─────────▼─┐   ┌─▼──────────┐
              │ Scheduler │   │ PostgreSQL │
              └─────┬─────┘   └────────────┘
                    │
            ┌───────▼────────┐
            │ Check Queue     │
            │ Redis / Broker  │
            └───────┬────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
   Probe: India  Probe: EU   Probe: US
       │            │            │
       └────────────┼────────────┘
                    ▼
             Check results
                    │
             ┌──────▼──────┐
             │ Aggregator  │
             └──────┬──────┘
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
   Time-series store        Incident engine
                                 │
                           Notifications
```

### Important backend requirements

- Jobs must be idempotent.
- A single failed probe should not immediately mark a service globally down.
- Support quorum or multi-region confirmation for critical monitors.
- Store raw check results separately from aggregated analytics.
- Keep an audit trail for configuration changes.

---

## 21. Status Calculation Rules

A suggested first implementation:

### Up

A monitor is `UP` when the latest check succeeds and latency is within configured limits.

### Degraded

A monitor is `DEGRADED` when the latest checks succeed but performance violates a configured latency threshold or only a subset of probes is failing.

### Down

A monitor becomes `DOWN` after the configured number of consecutive failed checks or a multi-region failure threshold is reached.

### Recovery

A monitor returns to `UP` only after a successful recovery check. Optionally require two consecutive successes to avoid flapping.

---

## 22. Notifications and Incident Lifecycle

```text
Healthy
   │
   ▼
Failure detected
   │
   ▼
Retry / confirmation
   │
   ├── false alarm → Healthy
   │
   ▼
Incident created
   │
   ▼
Notification sent
   │
   ▼
Repeated checks / escalation
   │
   ▼
Recovery detected
   │
   ▼
Incident resolved
   │
   ▼
Recovery notification
```

Include anti-flapping controls and configurable notification cooldowns.

---

## 23. Micro-interactions

The design should feel responsive without being flashy.

- Status dot gently changes on state transition.
- “Check now” shows a short progress state and replaces it with the result.
- New incidents appear at the top of the incidents panel.
- Filters update content immediately.
- Hovering a chart reveals exact timing values.
- Clicking a status badge can filter the current view.
- Successful recovery should show a subtle confirmation toast.
- Destructive actions require confirmation.

Avoid excessive animation in monitoring data because users often keep the dashboard open for long periods.

---

## 24. Example Dashboard Content

Use realistic data when building the first prototype:

```text
Workspace: Acme Systems

24 monitors       23 up       1 degraded       0 down
99.98% uptime     84ms avg    1 active incident

Monitors

● Production API       api.acme.com/health     99.99%   82ms   200   12s ago
● Web App               acme.com               100%     116ms  200   18s ago
● Auth Service          auth.acme.com/health    99.95%   143ms  200   11s ago
▲ Payments API          pay.acme.com/health     99.71%   812ms  200   8s ago
● Docs                  docs.acme.com           100%     91ms   200   14s ago
```

An active incident example:

```text
Payments API
Degraded

p95 latency above 800ms for 7 minutes
Started 16:20 · Mumbai + Singapore
```

---

## 25. MVP Scope

### Must have

- Authentication
- Workspace
- Create/edit/delete monitors
- HTTP/HTTPS monitoring
- Configurable interval
- Up/down/degraded state
- Uptime calculation
- Response-time tracking
- Incident creation/resolution
- Email notifications
- Monitor list
- Monitor detail page
- Basic analytics

### Should have

- Multi-region checks
- DNS/TCP/TLS timing
- Slack/webhook notifications
- Public status pages
- SSL expiry alerts
- Response-content assertions

### Later

- Synthetic browser checks
- Distributed tracing integrations
- Advanced SLO management
- On-call escalation policies
- AI-assisted incident diagnosis

---

## 26. Key Screens to Design First

For a Figma or frontend implementation, build in this order:

1. **Overview dashboard** — establishes the visual system.
2. **Monitors list** — establishes the primary data pattern.
3. **Monitor detail** — establishes charts and investigation UX.
4. **Create monitor** — establishes setup flow.
5. **Incident detail** — establishes failure/recovery workflow.
6. **Alerting settings** — establishes integrations and rules.
7. **Status page** — establishes the public-facing design.

---

## 27. Definition of Done for the UI

The first release of the design is successful when a user can:

- See overall system health immediately.
- Identify a failing or degraded monitor without opening it.
- Open a monitor and understand its recent uptime and latency.
- Determine when an incident started and whether it recovered.
- Create a new URL monitor in less than a minute.
- Configure at least one notification rule.
- Inspect DNS / network timing when diagnosing slow requests.
- Use the interface comfortably on desktop and mobile.

---

## 28. Final Design Character

The product should feel like **an operational control center with the visual polish of a modern SaaS product**.

The reference should influence the **structure and visual rhythm**, not be copied literally:

- Keep the rounded shell and sidebar pattern.
- Keep compact metric rows and grouped data cards.
- Keep the muted neutral canvas.
- Keep semantic colors restrained.
- Replace API-management concepts with uptime, latency, DNS, incidents, and alerts.
- Make failures visually obvious without making the entire interface look alarming.

The final experience should communicate:

> **Everything is quiet when things are healthy; the UI becomes loud only when something needs attention.**

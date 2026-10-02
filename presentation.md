# API Pulse: Distributed API & Service Monitoring

## 1. What is API Pulse?
API Pulse is a production-grade, distributed uptime and latency monitoring platform. It actively probes APIs, websites, and TCP services at high frequencies from multiple geographic regions, tracking availability and granular network performance.

## 2. Why We Need This Project
In modern distributed architectures, downtime translates directly to lost revenue and broken user trust. We need this project to:
- **Ensure SLAs:** Continuously measure and enforce Service Level Agreements.
- **Isolate Bottlenecks:** Granular timings help teams know immediately if a slowdown is caused by DNS resolution, slow TLS handshakes, or a struggling backend (TTFB).
- **Global Visibility:** Detect regional routing issues by probing from multiple global vantage points.
- **Rapid Incident Response:** Alert engineering teams immediately when quorums fail, reducing Mean Time To Resolution (MTTR).

## 3. Explaining the Complete Project
API Pulse offers a full lifecycle solution:
- **User Dashboard:** A beautiful, dark-mode optimized React frontend where users can define monitors, view historical SLA timelines, and analyze latency breakdowns via interactive charts.
- **Probing Engine:** A fleet of distributed workers that wake up on precise intervals, execute network requests safely, and report back.
- **Evaluation & Alerting:** A real-time stream processing pipeline that evaluates probe results against sliding-window quorums. If an endpoint is confirmed down across multiple regions, it immediately opens an incident and dispatches webhooks/Slack alerts.

## 4. Technologies
- **Frontend:** React (TypeScript), Tailwind CSS, Recharts, Vite.
- **Backend Services:** Node.js, Fastify, TypeScript.
- **Database (Persistent):** PostgreSQL (stores users, monitor configs, incidents, and massive timeseries check results).
- **In-Memory Store:** Redis (caching, timer wheels, distributed locks, state evaluation).
- **Message Broker:** Redpanda / Kafka (event-driven job distribution, result processing, alerting).
- **Infrastructure:** Docker & Docker Compose.

## 5. Design & User Experience
The platform emphasizes a clean, developer-focused UX:
- **Analytics Dashboard:** Uses KPI cards for uptime percentages and average response times.
- **Availability History:** Features a GitHub-style segmented SLA timeline (Green/Amber/Red) representing chronological buckets.
- **Granular Visualizations:** Stacked area charts break down total latency into DNS, TCP, TLS, TTFB, and Download phases.
- **Security-First:** Backend SSRF (Server-Side Request Forgery) protections prevent users from probing internal networks.

## 6. Architecture
The backend uses an event-driven microservices architecture:
1. **API / Auth Services:** Stateless REST APIs that serve the frontend and handle JWT-based authentication via `httpOnly` secure cookies.
2. **Scheduler:** A daemon that reconciles active monitors and uses a **Redis Timer Wheel**. Every second, it pops due jobs and publishes them to Kafka topics based on target regions.
3. **Worker:** Region-specific consumers (e.g., `worker-us-east`) that pull jobs from Kafka, perform strict HTTP/TCP requests (with 5MB body limits and DNS rebinding protections), and publish `CheckResults` back to Kafka.
4. **Evaluator:** Consumes results from Kafka. Maintains real-time state machines for each monitor. Uses Redis sliding windows to enforce "failure quorums" before transitioning a monitor to `DOWN`.
5. **Notifier:** Listens to incident events, fetches tenant-specific notification channels from the database, and safely dispatches alerts with Redis-backed deduplication.

## 7. How We Scale It
- **Horizontal Scaling via Kafka:** Redpanda/Kafka topics are partitioned. We can add infinite Worker and Evaluator replicas; Kafka consumer groups will automatically balance the load.
- **Geographic Scaling:** Workers can be deployed across the globe (AWS, GCP, DigitalOcean). They simply subscribe to their specific regional topic (e.g., `jobs.region.eu-central`).
- **Stateless APIs:** The API and Auth layers share nothing and can be scaled infinitely behind a standard load balancer.

## 8. How We Handle Database Load
PostgreSQL is protected from the massive throughput of constant pinging:
- **Redis Caching:** The API caches dashboard statistics using Redis pipelines, preventing N+1 queries. The Scheduler caches monitor configurations to avoid querying the DB every second.
- **State Offloading:** The Evaluator writes to PostgreSQL *only* when a state transition occurs (e.g., an Incident is opened or resolved). Routine passing checks are processed in Redis.
- **Timeseries Optimization:** Raw `check_results` are written efficiently. (For production, this table is designed to be easily migrated to TimescaleDB or standard PostgreSQL table partitioning).

## 9. How It Is Fault Tolerant
- **Guaranteed Execution:** Jobs and results flow through Kafka. If a Worker crashes mid-probe, the job remains unacknowledged and is retried.
- **Quorum-based Alerting:** Transient network blips don't trigger pager storms. The Evaluator requires multiple consecutive failures or cross-region consensus within a 60-second sliding window before confirming an outage.
- **Scheduler Leader Election:** Multiple Scheduler replicas can run simultaneously. They use Redis Distributed Locks (`sched:lock:shard`) to ensure only one replica processes a time-shard, providing High Availability without collisions.
- **Idempotency & Deduplication:** The Notifier uses atomic Redis locks to guarantee that multiple evaluating threads don't send duplicate Slack alerts for the same incident.

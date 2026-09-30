# Quodor — Team Communication Platform (Slack alternative)

Mone hadama build karanna oni unna full-stack project ekak. Backend eka Node/Express + Prisma + PostgreSQL, frontend eka React 18 + Redux Toolkit + Tailwind. Realtime diffuse Socket.io, auth Clerk, AI OpenRouter vagen.

## Project eke tiken

```
quodor ide teams/
├── client/    → React app (Vite)
├── server/    → Express API + Socket.io + jobs
│   ├── prisma/   → schema + migrations + seed
│   └── src/
│       ├── routes/       → URL definitions
│       ├── controllers/  → request/response (thin layer)
│       ├── services/     → business logic (mata logic mine m)
│       ├── socket/       → realtime handlers
│       ├── jobs/         → cron tasks (reminders, cleanup)
│       ├── middleware/   → auth, roles, errors, rate limits
│       └── utils/        → email, pdf, api errors
└── PLAN.md    → plan eka (Sinhala)
```

## Hodo ganneya (steps)

### 1. Database eka

PostgreSQL ekak run wenna oni (local venna docker ekak hari). Docker use karthen:

```bash
docker run -d --name quodor-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=quodor -p 5432:5432 postgres:16
```

### 2. Server eka

```bash
cd server
copy .env.example .env    # (windows) / cp .env.example .env (mac/linux)
# .env eke Clerk keys, DB url, OpenRouter key wagen dmo
npm install
npx prisma migrate dev    # tables hadenne
npx prisma db seed        # test data
npm run dev               # http://localhost:5000
```

### 3. Client eka

```bash
cd client
copy .env.example .env    # VITE_CLERK_PUBLISHABLE_KEY dmo
npm install
npm run dev               # http://localhost:5173
```

Browser eken http://localhost:5173 open karala Clerk vatin sign in kna.
Sign in udfata → workspace ekak hadala → channels/DMs vatin messagen dana laanna puluwan.

## API eka wagennak

- Base URL: `http://localhost:5000/api`
- Sihine request ekenma `Authorization: Bearer <clerk-jwt>` + `x-workspace-id: <id>` headers yannevi (client eka m de automatic ganannen).
- Response pattern eka: `{ success, message, data, meta, timestamp }`

## Features map

| Feature | Endpoint/Socket | Page |
|---|---|---|
| Auth (Clerk sync) | POST /auth/sync | SignIn |
| Workspaces | /workspaces | WorkspacePicker |
| Channels + messages | /channels, /messages, /conversations/:id/messages | ChannelView |
| DMs | /dms | DmView |
| Reactions/threads | POST /messages/:id/reactions | MessageItem |
| Search (pg_trgm + AI) | POST /search | SearchPage |
| Analytics | /analytics/* | AnalyticsPage |
| Admin (audit, holds, billing) | /admin/* | AdminPage |
| Settings | /auth/profile, /notification-preferences | SettingsPage |
| Realtime | Socket.io: message:new, presence:update, call:* | useSocket |

## Jobs (cron)

Server eke `ENABLE_JOBS=false` dpm cron jobs niutfen wenva:
- reminders — minute piyn check krenna
- digests — piyin ekvaren
- cleanup — retention, guest expiry
- analytics snapshot — dnasik

## Learn karanwa widihak (reading order)

Code eken kapin widahak ekak thiyenne: **Routes → Controllers → Services → Prisma**.
1. `routes/message.routes.js` balanna — URL ken middleware eka
2. `controllers/message.controller.js` — body eke validate krla service ekata yanwa
3. `services/message.service.js` — logic meka thiyenne, prisma call wafka
4. `socket/message.socket.js` — socket ekenmi service eke function ekrn ekaca ganne use krenne

Eka me project eke pattern eka — code ekawen wensata logic ekak na.

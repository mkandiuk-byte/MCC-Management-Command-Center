# MCC Deployment Guide

## Quick Deploy

### Option A: Vercel (Recommended — Free)

1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect GitHub repo: `mkandiuk-byte/MCC-Management-Command-Center`
3. Framework: Next.js (auto-detected)
4. Add Environment Variables:

```
JIRA_BASE_URL=https://upstars.atlassian.net
JIRA_USERNAME=m.kandiuk@upstars.com
JIRA_API_TOKEN=<your token>
CONFLUENCE_BASE_URL=https://upstars.atlassian.net/wiki
AIRTABLE_API_TOKEN=<your token>
KEITARO_URL=https://keitaro.make-admin.com
KEITARO_API_KEY=<your key>
GITHUB_ORGS=upstars
MCC_ACCESS_PASSWORD=<choose a password>
```

5. Deploy → get URL like `mcc-xyz.vercel.app`
6. Share URL + password with team

### Option B: VPS with PM2

```bash
# On server
git clone https://github.com/mkandiuk-byte/MCC-Management-Command-Center.git
cd MCC-Management-Command-Center
cp .env.example .env.local  # fill in credentials
npm install -g pnpm
pnpm install
pnpm build
pnpm start  # runs on port 3777
```

With PM2:
```bash
pm2 start "pnpm start" --name mcc
pm2 save
```

With nginx reverse proxy:
```nginx
server {
    server_name mcc.yourdomain.com;
    location / {
        proxy_pass http://localhost:3777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option C: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3777
CMD ["pnpm", "start"]
```

```bash
docker build -t mcc .
docker run -d -p 3777:3777 --env-file .env.local mcc
```

## Access Control

Set `MCC_ACCESS_PASSWORD` env var to enable password protection.
- Login page at `/login`
- Cookie-based session (30 days)
- If `MCC_ACCESS_PASSWORD` is not set, no auth required (local dev)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JIRA_BASE_URL` | Yes | Jira instance URL |
| `JIRA_USERNAME` | Yes | Jira email |
| `JIRA_API_TOKEN` | Yes | Jira API token |
| `KEITARO_URL` | Yes | Keitaro tracker URL |
| `KEITARO_API_KEY` | Yes | Keitaro API key |
| `AIRTABLE_API_TOKEN` | Yes | Airtable personal access token |
| `MCC_ACCESS_PASSWORD` | No | Shared access password |
| `CONFLUENCE_BASE_URL` | No | Confluence wiki URL |
| `GITHUB_ORGS` | No | GitHub orgs for PR tracking |

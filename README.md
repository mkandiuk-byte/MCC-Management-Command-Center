# AAP Panel

A personal admin panel built with Next.js that integrates your local workspace, Jira boards, GitHub PRs, and Claude Code configuration into a single interface.

## Features

- **Jira Boards** — track sprint issues with PR statuses, assignees; configurable boards via `.panel-config.json`
- **GitHub PR Sync** — automatically matches Jira issues to GitHub PRs by title or branch name; supports multiple orgs; 5-min in-memory cache
- **Repository Manager** — scan local directories for git repos, view branch/dirty/ahead-behind status, pull, clone
- **File Browser** — browse configured workspace and Claude config directories
- **Claude Tools** — view and manage Skills, Tools, Instructions, MCP servers; embedded Claude terminal
- **Command Palette** — `⌘K` quick navigation across all sections
- **PWA-ready** — installable as a mobile/desktop web app

## Requirements

- Node.js 18+
- pnpm
- `node-pty` native module (for the Claude terminal feature)

## Setup

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
Copy `.env.example` to `.env.local` and fill in your values:
```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `JIRA_BASE_URL` | Your Jira instance URL (e.g. `https://company.atlassian.net`) |
| `JIRA_USERNAME` | Jira account email |
| `JIRA_API_TOKEN` | Jira API token — [generate here](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `GITHUB_TOKEN` | GitHub personal access token (needs `repo` + `read:org` scopes) |
| `GITHUB_ORGS` | Comma-separated GitHub orgs to search PRs in (e.g. `org1,org2`) |
| `WORKSPACE_PATH` | Absolute path to your projects workspace directory |
| `CLAUDE_PATH` | Absolute path to your Claude Code config directory |

### 3. Configure Jira boards
Copy `.panel-config.example.json` to `.panel-config.json` and add your boards:
```bash
cp .panel-config.example.json .panel-config.json
```

### 4. Build and run
```bash
pnpm build
pnpm start
```

Or for development:
```bash
pnpm dev
```

Default port: `3777`. Override with the `APP_PORT` env var.

## Running as a background service (macOS launchd)

Use `start.sh` with a launchd plist. Pass all environment variables in the `EnvironmentVariables` dict — see `.env.example` for the full list.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.yourname.aap-panel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/absolute/path/to/AAP_panel/start.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>JIRA_BASE_URL</key><string>https://company.atlassian.net</string>
    <key>JIRA_USERNAME</key><string>you@company.com</string>
    <key>JIRA_API_TOKEN</key><string>your_token_here</string>
    <key>GITHUB_TOKEN</key><string>ghp_your_token_here</string>
    <key>GITHUB_ORGS</key><string>org1,org2</string>
    <key>WORKSPACE_PATH</key><string>/absolute/path/to/workspace</string>
    <key>CLAUDE_PATH</key><string>/absolute/path/to/claude/config</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
```

## How PR matching works

Jira issues are matched to GitHub PRs in two passes:

1. **Title/body search** — batch query for issue keys in PR title/body (6 keys per request)
2. **Branch search** — for unmatched issues, searches `head:ISSUE-KEY` to find PRs where the branch name starts with the key (e.g. branch `ASD-1724-my-feature`)

When multiple PRs exist for one issue, the best status wins: `open > draft > merged > closed`

| Badge | Meaning |
|-------|---------|
| Working on | No PR found |
| Draft | PR is a draft |
| In Review | PR is open and ready for review |
| Merged | PR was merged |
| Closed | PR was closed without merging |

## Tech stack

- [Next.js 15](https://nextjs.org) App Router
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [node-pty](https://github.com/microsoft/node-pty) — terminal emulation
- [simple-git](https://github.com/steveukx/git-js) — repository scanning

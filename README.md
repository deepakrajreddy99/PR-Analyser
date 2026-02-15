# GitHub PR Analyzer

A web tool that analyzes GitHub Pull Requests and generates an instant review summary.

## What this tool does
- Accepts a GitHub Pull Request URL
- Fetches changed files using GitHub API
- Calculates PR metrics (files changed, additions, deletions, churn)
- Identifies high-impact folders (hotspots)
- Assigns a risk level (Low / Medium / High) with reasons
- Generates a Markdown review report for easy copy-paste into GitHub PR comments

## Demo PR (try this)
https://github.com/vercel/next.js/pull/1

## Tech Stack
- Next.js (App Router)
- TypeScript
- Node.js
- GitHub REST API (Octokit)

## How to run locally

### 1) Install dependencies
```bash
npm install

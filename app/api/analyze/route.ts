import { NextResponse } from "next/server";
import { Octokit } from "octokit";

function parsePrUrl(input: string) {
  const url = (input || "").trim();
  // supports: https://github.com/OWNER/REPO/pull/123 and also /pull/123/files
  const m = url.match(/https?:\/\/(www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (!m) return null;

  return { owner: m[2], repo: m[3], pull_number: Number(m[4]) };
}

async function listAllFiles(octokit: Octokit, owner: string, repo: string, pull_number: number) {
  const per_page = 100;
  let page = 1;
  const all: any[] = [];

  while (true) {
    const res = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
      owner,
      repo,
      pull_number,
      per_page,
      page,
    });
    all.push(...res.data);
    if (res.data.length < per_page) break;
    page++;
  }
  return all;
}

function analyze(files: any[]) {
  const totalFiles = files.length;

  let additions = 0;
  let deletions = 0;

  const fileStats = files.map((f: any) => {
    additions += f.additions || 0;
    deletions += f.deletions || 0;
    return {
      filename: f.filename,
      additions: f.additions || 0,
      deletions: f.deletions || 0,
      changes: f.changes || 0,
      status: f.status,
    };
  });

  const churn = additions + deletions;

  // biggest files by churn
  const biggestFiles = [...fileStats].sort((a, b) => b.changes - a.changes).slice(0, 8);

  // hotspots (top dirs)
  const dirMap = new Map<string, number>();
  for (const f of fileStats) {
    const dir = f.filename.split("/").slice(0, 2).join("/") || "(root)";
    dirMap.set(dir, (dirMap.get(dir) || 0) + f.changes);
  }
  const hotspots = [...dirMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([dir, churn]) => ({ dir, churn }));

  // risk scoring (simple + useful)
  let score = 0;
  const reasons: string[] = [];

  if (totalFiles >= 25) {
    score += 2;
    reasons.push("Large PR: many files changed");
  }
  if (churn >= 800) {
    score += 2;
    reasons.push("Large PR: high churn (additions + deletions)");
  }

  const filenamesJoined = fileStats.map((f) => f.filename).join("\n");

  const patterns = [
    { re: /(auth|security|oauth|jwt|password|login)/i, pts: 3, reason: "Touches auth/security related code" },
    { re: /(migration|migrations|schema|db|database)/i, pts: 3, reason: "Touches database/migrations/schema" },
    { re: /(github\/workflows|ci|terraform|helm|k8s|kubernetes)/i, pts: 2, reason: "Touches CI/infra config" },
    { re: /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|requirements\.txt|poetry\.lock)/i, pts: 2, reason: "Touches dependency lockfiles" },
  ];

  for (const p of patterns) {
    if (p.re.test(filenamesJoined)) {
      score += p.pts;
      reasons.push(p.reason);
    }
  }

  const hasCodeTouched = fileStats.some((f) => /\.(ts|tsx|js|jsx|py|java|go|cs|rb|php)$/i.test(f.filename));
  const hasTestsTouched = fileStats.some((f) => /(^|\/)(test|tests|__tests__)\b|\.spec\.|\.test\./i.test(f.filename));
  if (hasCodeTouched && !hasTestsTouched) {
    score += 2;
    reasons.push("Code changed but tests were not updated");
  }

  const level = score >= 6 ? "high" : score >= 3 ? "medium" : "low";

  return {
    metrics: { totalFiles, additions, deletions, churn },
    risk: { level, score, reasons },
    hotspots,
    biggestFiles,
  };
}

function toMarkdown(pr: any, report: any) {
  const { metrics, risk, hotspots, biggestFiles } = report;

  const riskReasons = risk.reasons.length ? risk.reasons.map((r: string) => `- ${r}`).join("\n") : "- No major risk flags detected";

  return `# PR Review Report

**Title:** ${pr.title}
**Repo:** ${pr.base?.repo?.full_name}
**Author:** ${pr.user?.login}
**URL:** ${pr.html_url}

## Metrics
- Files changed: **${metrics.totalFiles}**
- Additions: **${metrics.additions}**
- Deletions: **${metrics.deletions}**
- Total churn: **${metrics.churn}**

## Risk
**Level:** **${String(risk.level).toUpperCase()}** (score: ${risk.score})
${riskReasons}

## Hotspots (by churn)
${hotspots.map((h: any) => `- ${h.dir}: ${h.churn}`).join("\n")}

## Biggest changed files
${biggestFiles.map((f: any) => `- \`${f.filename}\` (+${f.additions}/-${f.deletions}, changes: ${f.changes})`).join("\n")}
`;
}

export async function POST(req: Request) {
  try {
    const { prUrl } = await req.json();

    const parsed = parsePrUrl(prUrl);
    if (!parsed) return NextResponse.json({ error: "Invalid GitHub PR URL" }, { status: 400 });

    const token = process.env.GITHUB_TOKEN;
    if (!token) return NextResponse.json({ error: "Missing GITHUB_TOKEN in .env.local" }, { status: 500 });

    const octokit = new Octokit({ auth: token });
    const { owner, repo, pull_number } = parsed;

    const pr = (
      await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number,
      })
    ).data;

    const files = await listAllFiles(octokit, owner, repo, pull_number);

    const report = analyze(files);
    const markdown = toMarkdown(pr, report);

    return NextResponse.json({
      pr: {
        title: pr.title,
        url: pr.html_url,
        author: pr.user?.login,
        repo: pr.base?.repo?.full_name,
      },
      report,
      markdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}

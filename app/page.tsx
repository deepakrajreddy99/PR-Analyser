"use client";
import { useMemo, useState } from "react";

function Pill({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #374151",
        background: "#111827",
        color: "#F9FAFB",
        fontSize: 12,
      }}
    >
      {text}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #374151",
        borderRadius: 12,
        padding: 14,
        background: "#0B1220",
        color: "#F9FAFB",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  const riskPillText = useMemo(() => {
    const level = data?.report?.risk?.level;
    if (!level) return "";
    const score = data?.report?.risk?.score ?? 0;
    return `Risk: ${String(level).toUpperCase()} (score ${score})`;
  }, [data]);

  async function analyze() {
    setErr("");
    setData(null);
    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl: url }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "API failed");
      setData(json);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    alert("Copied ✅");
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16, fontFamily: "system-ui", color: "#F9FAFB" }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>GitHub PR Analyzer</h1>
      <p style={{ marginTop: 0, color: "#CBD5E1" }}>Paste a GitHub PR URL to generate a review report (metrics + risk + hotspots + markdown).</p>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/vercel/next.js/pull/1"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #374151",
            background: "#0B1220",
            color: "#F9FAFB",
            outline: "none",
          }}
        />
        <button
          onClick={analyze}
          disabled={!url || loading}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #374151",
            background: loading ? "#111827" : "#1F2937",
            color: "#F9FAFB",
            cursor: loading ? "not-allowed" : "pointer",
            minWidth: 110,
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {err && <p style={{ color: "#FCA5A5", marginTop: 12 }}>{err}</p>}

      {data?.pr && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Pill text={data.pr.repo || "repo"} />
          <Pill text={`Author: ${data.pr.author || "unknown"}`} />
          {riskPillText && <Pill text={riskPillText} />}
          <button
            onClick={() => copyText(data.pr.url)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #374151", background: "#0B1220", color: "#F9FAFB" }}
          >
            Copy PR URL
          </button>
        </div>
      )}

      {data?.report && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card title="Metrics">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>Files changed: <b>{data.report.metrics.totalFiles}</b></div>
              <div>Churn: <b>{data.report.metrics.churn}</b></div>
              <div>Additions: <b>{data.report.metrics.additions}</b></div>
              <div>Deletions: <b>{data.report.metrics.deletions}</b></div>
            </div>
          </Card>

          <Card title="Risk Reasons">
            {data.report.risk.reasons?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: "#E5E7EB" }}>
                {data.report.risk.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            ) : (
              <div style={{ color: "#E5E7EB" }}>No major risk flags detected.</div>
            )}
          </Card>

          <Card title="Hotspots">
            <ul style={{ margin: 0, paddingLeft: 18, color: "#E5E7EB" }}>
              {data.report.hotspots.map((h: any, i: number) => (
                <li key={i}>
                  <code style={{ color: "#F9FAFB" }}>{h.dir}</code> — churn <b>{h.churn}</b>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Biggest Files">
            <ul style={{ margin: 0, paddingLeft: 18, color: "#E5E7EB" }}>
              {data.report.biggestFiles.map((f: any, i: number) => (
                <li key={i}>
                  <code style={{ color: "#F9FAFB" }}>{f.filename}</code> — +{f.additions}/-{f.deletions} (changes {f.changes})
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {data?.markdown && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h2 style={{ margin: "12px 0" }}>Markdown Report</h2>
            <button
              onClick={() => copyText(data.markdown)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #374151", background: "#0B1220", color: "#F9FAFB" }}
            >
              Copy Markdown
            </button>
            <button
              onClick={() => copyText(JSON.stringify(data, null, 2))}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #374151", background: "#0B1220", color: "#F9FAFB" }}
            >
              Copy Full JSON
            </button>
          </div>

          <pre
            style={{
              background: "#111827",
              color: "#F9FAFB",
              padding: 12,
              borderRadius: 12,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              border: "1px solid #374151",
            }}
          >
            {data.markdown}
          </pre>
        </div>
      )}
    </main>
  );
}

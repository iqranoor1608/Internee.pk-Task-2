import { useState, useRef, useCallback } from "react";
import * as mammoth from "mammoth";
import {
  UploadCloud,
  FileText,
  Radar,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  MessageSquare,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

/* ------------------------------------------------------------------
   Design tokens
   Navy control-room background, amber "scan" accent, mono readouts.
   Signature element: the radial score dial + sweeping scan-line while
   the resume panel is being analyzed.
------------------------------------------------------------------- */
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');`;

const COLORS = {
  bg: "#0A1220",
  panel: "#111D30",
  panelAlt: "#0D1826",
  line: "#22334D",
  amber: "#F2A93B",
  amberSoft: "#F7C873",
  fog: "#B9C3D4",
  white: "#F3F6FA",
  green: "#4ADE80",
  red: "#F26B5B",
};

async function callClaude(messages, system) {
  const res = await fetch("http://localhost:3001/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/* ------------------------------------------------------------------
   DEMO MODE
   Set to false once your server/index.js has a working ANTHROPIC_API_KEY
   and you want real AI analysis. While true, no network call is made —
   analyze() and sendChat() use the mock generators below instead, so you
   can demo the full UI with zero API cost.
------------------------------------------------------------------- */
const DEMO_MODE = true;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "a", "an", "to", "of", "in", "on", "or",
  "is", "are", "as", "at", "by", "be", "this", "that", "will", "your",
  "you", "we", "our", "within", "such", "similar", "tools", "skills",
]);

function guessKeywords(text) {
  return [...new Set(
    text
      .replace(/[•().,\n]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
  )].slice(0, 40);
}

function mockAnalyze(resumeText, jdText) {
  const jdWords = guessKeywords(jdText);
  const resumeLower = resumeText.toLowerCase();
  const matched = [];
  const missing = [];
  jdWords.forEach((w) => {
    if (resumeLower.includes(w.toLowerCase())) matched.push(w);
    else missing.push(w);
  });
  const matchedKeywords = matched.slice(0, 8);
  const missingKeywords = missing.slice(0, 6);
  const total = matchedKeywords.length + missingKeywords.length || 1;
  const score = Math.round((matchedKeywords.length / total) * 100);

  return {
    score,
    matchedKeywords,
    missingKeywords,
    strengths: [
      "Resume includes relevant technical terms found in the job description",
      "Contact details and structure are clear and easy to scan",
      "Experience section shows measurable project involvement",
    ].slice(0, 3),
    weaknesses: [
      missingKeywords.length
        ? `Missing emphasis on: ${missingKeywords.slice(0, 3).join(", ")}`
        : "Consider tailoring language more closely to the job post",
      "Summary could state the target role more directly",
    ],
    suggestions: [
      "Mirror 2-3 key phrases from the job description in your summary",
      "Quantify achievements with numbers where possible",
      missingKeywords.length
        ? `Add a line demonstrating experience with ${missingKeywords[0] || "the missing skills"}`
        : "Keep tailoring each application to the specific posting",
    ],
    _demo: true,
  };
}

function mockChatReply(userMessage, analysis) {
  const lower = userMessage.toLowerCase();
  if (lower.includes("keyword") || lower.includes("missing")) {
    const list = analysis?.missingKeywords?.slice(0, 3).join(", ");
    return list
      ? `Try weaving in ${list} naturally, ideally in your summary or a bullet point tied to real experience — don't just list them.`
      : "Your keyword coverage already looks solid based on the last scan.";
  }
  if (lower.includes("summary") || lower.includes("objective")) {
    return "Open your summary with your target title and years of experience, then one line on your strongest, most relevant skill for this specific role.";
  }
  if (lower.includes("score")) {
    return `Your last score was ${analysis?.score ?? "--"}/100. That's mainly driven by keyword overlap — tightening your bullet points toward the job description usually moves it the most.`;
  }
  return "Good question — this demo mode gives general guidance since it isn't connected to live AI yet. Once your API key is set up, I'll tailor answers directly to your resume text.";
}


function ScoreDial({ score, loading }) {
  const size = 176;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const offset = c - (pct / 100) * c;
  const ticks = Array.from({ length: 24 });

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        {ticks.map((_, i) => {
          const angle = (i / ticks.length) * 2 * Math.PI - Math.PI / 2;
          const x1 = size / 2 + Math.cos(angle) * (r + 10);
          const y1 = size / 2 + Math.sin(angle) * (r + 10);
          const x2 = size / 2 + Math.cos(angle) * (r + 15);
          const y2 = size / 2 + Math.sin(angle) * (r + 15);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={COLORS.line}
              strokeWidth={2}
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.line}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.amber}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={loading ? c * 0.75 : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <Loader2 size={26} color={COLORS.amber} className="spin" />
        ) : (
          <>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 40,
                fontWeight: 700,
                color: COLORS.white,
                lineHeight: 1,
              }}
            >
              {score ?? "--"}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: 2,
                color: COLORS.fog,
                marginTop: 6,
              }}
            >
              MATCH SCORE
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Chip ------------------------------- */
function Chip({ label, tone }) {
  const map = {
    good: { bg: "rgba(74,222,128,0.12)", fg: COLORS.green, border: "rgba(74,222,128,0.35)" },
    bad: { bg: "rgba(242,107,91,0.12)", fg: COLORS.red, border: "rgba(242,107,91,0.35)" },
  };
  const c = map[tone] || map.good;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12.5,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        margin: "0 6px 6px 0",
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------- Main App ------------------------------- */
export default function ResumeAnalyzer() {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [jdText, setJdText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setResumeText(result.value.trim());
      } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
        const text = await file.text();
        setResumeText(text.trim());
      } else if (lower.endsWith(".pdf")) {
        setError(
          "PDF parsing isn't available in this preview — please paste your resume text directly, or upload a .docx/.txt file."
        );
      } else {
        setError("Unsupported file type. Use .docx, .txt, or paste your resume text.");
      }
    } catch {
      setError("Couldn't read that file. Try pasting your resume text instead.");
    }
  }, []);

  const analyze = async () => {
    if (!resumeText.trim() || !jdText.trim()) {
      setError("Add both your resume text and a job description before scanning.");
      return;
    }
    setError("");
    setLoading(true);
    setScanning(true);
    setAnalysis(null);
    try {
      if (DEMO_MODE) {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        const parsed = mockAnalyze(resumeText, jdText);
        setAnalysis(parsed);
        setChatMessages([
          {
            role: "assistant",
            content: `Scan complete — match score ${parsed.score}/100. Ask me anything about tightening this resume for the role.`,
          },
        ]);
        return;
      }
      const system =
        "You are a precise resume analysis engine embedded in a web app. Respond with ONLY raw JSON, no prose, no markdown fences. Schema: {\"score\": integer 0-100, \"matchedKeywords\": string[] (max 10), \"missingKeywords\": string[] (max 10), \"strengths\": string[] (max 4, short phrases), \"weaknesses\": string[] (max 4, short phrases), \"suggestions\": string[] (max 4, actionable, short)}";
      const userMsg = `RESUME:\n${resumeText.slice(0, 6000)}\n\nJOB DESCRIPTION:\n${jdText.slice(
        0,
        3000
      )}\n\nAnalyze the resume against the job description and return the JSON described in the system prompt.`;
      const text = await callClaude([{ role: "user", content: userMsg }], system);
      const parsed = extractJson(text);
      setAnalysis(parsed);
      setChatMessages([
        {
          role: "assistant",
          content: `Scan complete — match score ${parsed.score}/100. Ask me anything about tightening this resume for the role.`,
        },
      ]);
    } catch {
      setError("The scan didn't complete. Please try again in a moment.");
    } finally {
      setLoading(false);
      setTimeout(() => setScanning(false), 300);
    }
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const next = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(next);
    setChatInput("");
    setChatLoading(true);
    try {
      if (DEMO_MODE) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        const reply = mockChatReply(msg, analysis);
        setChatMessages([...next, { role: "assistant", content: reply }]);
        return;
      }
      const system = `You are a concise, encouraging resume coach chatbot embedded in an app. Keep replies under 90 words, plain text, no markdown headers. Context — resume:\n${resumeText.slice(
        0,
        4000
      )}\n\nJob description:\n${jdText.slice(0, 2000)}\n\nPrior analysis JSON:\n${JSON.stringify(
        analysis
      )}`;
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const reply = await callClaude(apiMessages, system);
      setChatMessages([...next, { role: "assistant", content: reply.trim() }]);
    } catch {
      setChatMessages([
        ...next,
        { role: "assistant", content: "I couldn't reach the analysis engine just now — try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const reset = () => {
    setResumeText("");
    setFileName("");
    setJdText("");
    setAnalysis(null);
    setError("");
    setChatMessages([]);
    setChatOpen(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.white,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        ::selection { background: ${COLORS.amber}; color: #0A1220; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scanline {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scan-panel { position: relative; overflow: hidden; }
        .scan-panel .beam {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, ${COLORS.amber}, transparent);
          box-shadow: 0 0 12px 2px ${COLORS.amber};
          animation: scanline 1.6s ease-in-out infinite;
        }
        textarea, input[type=text] {
          font-family: 'Inter', sans-serif;
        }
        textarea::placeholder, input::placeholder { color: #5C6C86; }
        .fade-in { animation: fadeIn 500ms ease both; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform: translateY(0);} }
        button { cursor: pointer; font-family: 'Inter', sans-serif; }
        .btn-primary:hover { background: ${COLORS.amberSoft} !important; }
        .btn-ghost:hover { border-color: ${COLORS.amber} !important; color: ${COLORS.amber} !important; }
        .dropzone:hover { border-color: ${COLORS.amber} !important; }
      `}</style>

      {/* ---------- Hero ---------- */}
      <header
        style={{
          borderBottom: `1px solid ${COLORS.line}`,
          padding: "36px 24px 30px",
          background:
            "radial-gradient(1200px 300px at 20% -10%, rgba(242,169,59,0.08), transparent)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: 3,
              color: COLORS.amber,
              marginBottom: 14,
            }}
          >
            <Radar size={15} />
            RESUME SCAN ENGINE
            {DEMO_MODE && (
              <span
                /*style={{
                  marginLeft: 4,
                  padding: "3px 9px",
                  borderRadius: 999,
                  fontSize: 10.5,
                  letterSpacing: 1.5,
                  background: "rgba(242,169,59,0.14)",
                  border: `1px solid rgba(242,169,59,0.4)`,
                  color: COLORS.amberSoft,
                }}*/
              >
                
              </span>
            )}
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 44px)",
              lineHeight: 1.08,
              margin: 0,
              maxWidth: 640,
              color: "#d38d23",
            }}
          >
            Know exactly where your resume stands before a human reads it.
          </h1>
          <p style={{ color: COLORS.fog, fontSize: 15.5, maxWidth: 560, marginTop: 14 }}>
            Drop in your resume and a job description. The engine parses, scores the
            match, flags missing keywords, and stays on the line to help you fix it.
          </p>
        </div>
      </header>

      {/* ---------- Input grid ---------- */}
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 24px 80px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          {/* Resume panel */}
          <div
            className="scan-panel"
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              minHeight: 320,
            }}
          >
            {scanning && <div className="beam" />}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <FileText size={16} color={COLORS.amber} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  letterSpacing: 1.5,
                  color: COLORS.fog,
                }}
              >
                01 · YOUR RESUME
              </span>
            </div>
            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              style={{
                border: `1px dashed ${COLORS.line}`,
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                transition: "border-color 150ms",
              }}
            >
              <UploadCloud size={17} color={COLORS.fog} />
              <span style={{ fontSize: 13.5, color: COLORS.fog }}>
                {fileName || "Upload .docx or .txt, or paste text below"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,.md,.pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              style={{
                flex: 1,
                minHeight: 160,
                background: COLORS.panelAlt,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 10,
                padding: 12,
                color: COLORS.white,
                fontSize: 13.5,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          {/* Job description panel */}
          <div
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              minHeight: 320,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ChevronRight size={16} color={COLORS.amber} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  letterSpacing: 1.5,
                  color: COLORS.fog,
                }}
              >
                02 · TARGET JOB DESCRIPTION
              </span>
            </div>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description you're targeting..."
              style={{
                flex: 1,
                minHeight: 210,
                background: COLORS.panelAlt,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 10,
                padding: 12,
                color: COLORS.white,
                fontSize: 13.5,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(242,107,91,0.1)",
              border: `1px solid rgba(242,107,91,0.35)`,
              color: COLORS.red,
              fontSize: 13.5,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            className="btn-primary"
            onClick={analyze}
            disabled={loading}
            style={{
              background: COLORS.amber,
              color: "#1A1204",
              border: "none",
              borderRadius: 10,
              padding: "12px 22px",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            {loading ? "Scanning..." : "Run scan"}
          </button>
          <button
            className="btn-ghost"
            onClick={reset}
            style={{
              background: "transparent",
              color: COLORS.fog,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        {/* ---------- Results ---------- */}
        {(analysis || loading) && (
          <section
            className="fade-in"
            style={{
              marginTop: 40,
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 32,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", flex: "0 0 auto" }}>
                <ScoreDial score={analysis?.score} loading={loading} />
              </div>

              <div style={{ flex: "1 1 320px", minWidth: 280 }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    letterSpacing: 1.5,
                    color: COLORS.fog,
                    marginBottom: 10,
                  }}
                >
                  KEYWORD MATCH
                </div>
                {loading ? (
                  <p style={{ color: COLORS.fog, fontSize: 13.5 }}>Comparing terms against the job description...</p>
                ) : (
                  <>
                    {analysis.matchedKeywords?.map((k) => (
                      <Chip key={k} label={k} tone="good" />
                    ))}
                    {analysis.missingKeywords?.map((k) => (
                      <Chip key={k} label={k} tone="bad" />
                    ))}
                  </>
                )}
              </div>
            </div>

            {!loading && analysis && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                  marginTop: 28,
                  paddingTop: 24,
                  borderTop: `1px solid ${COLORS.line}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <CheckCircle2 size={15} color={COLORS.green} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.white }}>Strengths</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.fog, fontSize: 13.5, lineHeight: 1.7 }}>
                    {analysis.strengths?.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <XCircle size={15} color={COLORS.red} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.white }}>Weaknesses</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.fog, fontSize: 13.5, lineHeight: 1.7 }}>
                    {analysis.weaknesses?.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <Sparkles size={15} color={COLORS.amber} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.white }}>Suggestions</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.fog, fontSize: 13.5, lineHeight: 1.7 }}>
                    {analysis.suggestions?.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---------- Chatbot ---------- */}
        {analysis && (
          <section
            className="fade-in"
            style={{
              marginTop: 24,
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setChatOpen((v) => !v)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: COLORS.white,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 600 }}>
                <MessageSquare size={16} color={COLORS.amber} />
                Ask the resume coach
              </span>
              <ChevronRight
                size={16}
                color={COLORS.fog}
                style={{ transform: chatOpen ? "rotate(90deg)" : "none", transition: "transform 150ms" }}
              />
            </button>
            {chatOpen && (
              <div style={{ borderTop: `1px solid ${COLORS.line}`, padding: 18 }}>
                <div
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        background: m.role === "user" ? COLORS.amber : COLORS.panelAlt,
                        color: m.role === "user" ? "#1A1204" : COLORS.fog,
                        border: m.role === "user" ? "none" : `1px solid ${COLORS.line}`,
                        borderRadius: 10,
                        padding: "9px 13px",
                        fontSize: 13.5,
                        maxWidth: "78%",
                        lineHeight: 1.5,
                      }}
                    >
                      {m.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ alignSelf: "flex-start", color: COLORS.fog, fontSize: 13 }}>
                      <Loader2 size={14} className="spin" style={{ display: "inline", marginRight: 6 }} />
                      thinking...
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Ask how to improve a specific section..."
                    style={{
                      flex: 1,
                      background: COLORS.panelAlt,
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 9,
                      padding: "10px 12px",
                      color: COLORS.white,
                      fontSize: 13.5,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatLoading}
                    style={{
                      background: COLORS.amber,
                      border: "none",
                      borderRadius: 9,
                      padding: "0 16px",
                      display: "flex",
                      alignItems: "center",
                      opacity: chatLoading ? 0.6 : 1,
                    }}
                  >
                    <Send size={15} color="#1A1204" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
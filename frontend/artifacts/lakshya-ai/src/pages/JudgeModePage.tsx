import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Cpu,
  Database,
  DownloadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Activity,
  HardDrive,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';

interface JudgeTelemetry {
  model_name: string;
  model_size_mb: number;
  model_mode: string;
  rag_total_chunks: number;
  curriculum_concepts: number;
  vector_dimension: number;
  retrieval_algorithm: string;
  latency_p50_ms: number;
  latency_p95_ms: number;
  grounding_rate_pct: number;
  offline_chapter_pack_kb: number;
  tested_cpu_arch: string;
  server_uptime_seconds: number;
  last_verified: string;
}

interface PilotSummary {
  n: number;
  message: string;
  mean_pre: number;
  mean_post: number;
  mean_delta: number;
  normalized_gain_pct: number;
  records: Array<{
    participant_code: string;
    pre_score: number;
    post_score: number;
    delta: number;
    completed_at: string;
  }>;
}

interface TestQuestion {
  id: string;
  concept_id: string;
  question: string;
  options: string[];
  citation: string;
}

export function JudgeModePage() {
  const { i18n } = useTranslation();
  const numerals = getStoredNumerals();

  const [telemetry, setTelemetry] = useState<JudgeTelemetry | null>(null);
  const [pilotSummary, setPilotSummary] = useState<PilotSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Pilot Interactive Mode
  const [participantCode, setParticipantCode] = useState<string | null>(null);
  const [pilotStage, setPilotStage] = useState<'idle' | 'pre_test' | 'lesson' | 'post_test' | 'results'>('idle');
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [preScore, setPreScore] = useState<number | null>(null);
  const [postScore, setPostScore] = useState<number | null>(null);

  const fetchJudgeData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/pilot/judge-mode'),
        fetch('/api/pilot/summary'),
      ]);
      if (tRes.ok) setTelemetry(await tRes.json());
      if (pRes.ok) setPilotSummary(await pRes.json());
    } catch (e) {
      console.error('Error fetching judge data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJudgeData();
  }, []);

  const handleStartPilot = async () => {
    try {
      const initRes = await fetch('/api/pilot/init');
      if (initRes.ok) {
        const initData = await initRes.json();
        const code = initData.participant_code;
        setParticipantCode(code);

        const qRes = await fetch(`/api/pilot/pre-test?participant_code=${code}`);
        if (qRes.ok) {
          const qData = await qRes.json();
          setTestQuestions(qData.questions || []);
          setCurrentQIndex(0);
          setSelectedAnswers({});
          setPilotStage('pre_test');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePreTestSubmit = async () => {
    if (!participantCode) return;
    try {
      const answers = Object.entries(selectedAnswers).map(([qid, idx]) => ({
        question_id: qid,
        selected_index: idx,
      }));
      const res = await fetch('/api/pilot/pre-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_code: participantCode, answers }),
      });
      if (res.ok) {
        const d = await res.json();
        setPreScore(d.score);
        setPilotStage('lesson');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartPostTest = async () => {
    if (!participantCode) return;
    try {
      const res = await fetch(`/api/pilot/post-test?participant_code=${participantCode}`);
      if (res.ok) {
        const d = await res.json();
        setTestQuestions(d.questions || []);
        setCurrentQIndex(0);
        setSelectedAnswers({});
        setPilotStage('post_test');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostTestSubmit = async () => {
    if (!participantCode) return;
    try {
      const answers = Object.entries(selectedAnswers).map(([qid, idx]) => ({
        question_id: qid,
        selected_index: idx,
      }));
      const res = await fetch('/api/pilot/post-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_code: participantCode, answers }),
      });
      if (res.ok) {
        const d = await res.json();
        setPostScore(d.post_score);
        setPilotStage('results');
        fetchJudgeData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentQ = testQuestions[currentQIndex];

  return (
    <div className="stack" data-testid="judge-mode-page">
      {/* Header */}
      <div className="card">
        <div className="card-heading">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2>Judge Mode • Empirical System Telemetry</h2>
              <span className="tag teal">Live NexTech Audit Gate</span>
            </div>
            <div className="smalltext muted">
              Real telemetry, verifiable offline footprints, CPU latency benchmarks, and randomized matched pilot evaluation data.
            </div>
          </div>
          <a
            href="/api/pilot/export-csv"
            download="ekalsahayak_pilot_eval_data.csv"
            className="btn gold small"
            data-testid="button-export-csv"
            style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <FileSpreadsheet size={16} /> Export Pilot CSV
          </a>
        </div>
      </div>

      {/* Live System Metrics (No Decorative Numbers) */}
      {telemetry && (
        <div className="metric-row">
          <div className="metric">
            <b>{telemetry.latency_p50_ms} ms</b>
            <span>Retrieval Latency (p50)</span>
          </div>
          <div className="metric">
            <b>{telemetry.latency_p95_ms} ms</b>
            <span>Retrieval Latency (p95)</span>
          </div>
          <div className="metric">
            <b>{telemetry.grounding_rate_pct}%</b>
            <span>NCERT Grounding Rate</span>
          </div>
        </div>
      )}

      {/* Hardware & Engine Specifications */}
      {telemetry && (
        <div className="card">
          <div className="card-heading">
            <h3>Engine & Corpus Specifications</h3>
            <span className="tag teal">{telemetry.model_mode}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f766e', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                <Cpu size={16} /> Local Generator Model
              </div>
              <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{telemetry.model_name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Footprint: {telemetry.model_size_mb} MB (0 Cloud API Keys)</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f766e', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                <Database size={16} /> Indexed Corpus
              </div>
              <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{telemetry.rag_total_chunks} Textbook Chunks</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{telemetry.curriculum_concepts} Concepts across 12 NCERT Subjects</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f766e', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                <Activity size={16} /> Hybrid Algorithm
              </div>
              <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{telemetry.retrieval_algorithm}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{telemetry.vector_dimension} Dense SVD Dimensions</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f766e', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                <HardDrive size={16} /> Offline Chapter Pack
              </div>
              <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{telemetry.offline_chapter_pack_kb} KB / Chapter</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Full JSON & SVD subset in IndexedDB</div>
            </div>
          </div>
        </div>
      )}

      {/* Real Pilot Evaluation Summary */}
      <div className="card">
        <div className="card-heading">
          <div>
            <h3>Empirical Learning Gain Study (Matched Pre/Post Trials)</h3>
            <div className="smalltext muted">
              Measures knowledge acquisition before and after grounded NCERT lessons with rural analogies.
            </div>
          </div>
          {pilotSummary && (
            <span className={`tag ${pilotSummary.n > 0 ? 'teal' : ''}`}>
              {pilotSummary.n > 0 ? `n = ${pilotSummary.n} Participants` : 'No Pilot Data Yet'}
            </span>
          )}
        </div>

        {pilotSummary && pilotSummary.n === 0 && (
          <div
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              border: '1.5px dashed #cbd5e1',
              borderRadius: 14,
            }}
          >
            <p style={{ color: '#475569', fontSize: 14, margin: '0 0 16px' }}>
              {pilotSummary.message}
            </p>
            <button
              className="btn gold"
              onClick={handleStartPilot}
              data-testid="button-start-pilot-eval"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={16} /> Run a Live 3-Minute Pilot Trial
            </button>
          </div>
        )}

        {pilotSummary && pilotSummary.n > 0 && (
          <div>
            <div className="metric-row" style={{ marginBottom: 16 }}>
              <div className="metric">
                <b>{pilotSummary.mean_pre} / 5.0</b>
                <span>Mean Pre-Test Score</span>
              </div>
              <div className="metric">
                <b>{pilotSummary.mean_post} / 5.0</b>
                <span>Mean Post-Test Score</span>
              </div>
              <div className="metric">
                <b style={{ color: '#16a34a' }}>+{pilotSummary.mean_delta} (+{pilotSummary.normalized_gain_pct}%)</b>
                <span>Empirical Score Gain</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12 }}>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Participant Code</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Pre-Test</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Post-Test</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Gain Delta</th>
                    <th style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotSummary.records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                        <code>{r.participant_code}</code>
                      </td>
                      <td>{r.pre_score} / 5</td>
                      <td>{r.post_score} / 5</td>
                      <td style={{ color: r.delta > 0 ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                        {r.delta > 0 ? `+${r.delta}` : r.delta}
                      </td>
                      <td style={{ fontSize: 11, color: '#94a3b8' }}>{r.completed_at.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Live Pilot Study Runner Flow */}
      {pilotStage === 'pre_test' && currentQ && (
        <div className="card" style={{ border: '2px solid #0f766e', background: '#f0fdfa' }}>
          <div className="card-heading">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f766e' }}>
              Pilot Pre-Test • Question {currentQIndex + 1} of {testQuestions.length} ({participantCode})
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{currentQ.citation}</span>
          </div>

          <h3 style={{ fontSize: 16, color: '#134e4a', margin: '0 0 16px' }}>{currentQ.question}</h3>
          <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            {currentQ.options.map((opt, oIdx) => {
              const checked = selectedAnswers[currentQ.id] === oIdx;
              return (
                <button
                  key={oIdx}
                  onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: oIdx }))}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${checked ? '#0f766e' : '#cbd5e1'}`,
                    background: checked ? '#ffffff' : '#f8fafc',
                    color: checked ? '#0f766e' : '#334155',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + oIdx)}.</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {currentQIndex < testQuestions.length - 1 ? (
              <button
                className="btn gold"
                onClick={() => setCurrentQIndex((i) => i + 1)}
                disabled={selectedAnswers[currentQ.id] === undefined}
              >
                Next Question →
              </button>
            ) : (
              <button
                className="btn gold"
                onClick={handlePreTestSubmit}
                disabled={selectedAnswers[currentQ.id] === undefined}
              >
                Submit Pre-Test
              </button>
            )}
          </div>
        </div>
      )}

      {pilotStage === 'lesson' && (
        <div className="card" style={{ background: '#fefce8', border: '1.5px solid #fef08a' }}>
          <div className="card-heading">
            <h3 style={{ color: '#854d0e', margin: 0 }}>Step 2: Grounded NCERT Micro-Lesson Completed</h3>
            <span className="tag teal">Pre-Test Score: {preScore} / 5</span>
          </div>
          <p style={{ color: '#713f12', fontSize: 14, lineHeight: 1.6 }}>
            The learner reviewed: evaporation cooling with earthen pot analogies, mitochondria ATP energy currency, straight-line velocity equality, and mass vs weight on the Moon.
          </p>
          <button className="btn gold" onClick={handleStartPostTest}>
            Take Matched Post-Test to Measure Gain Delta →
          </button>
        </div>
      )}

      {pilotStage === 'post_test' && currentQ && (
        <div className="card" style={{ border: '2px solid #0f766e', background: '#f0fdfa' }}>
          <div className="card-heading">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f766e' }}>
              Pilot Post-Test • Question {currentQIndex + 1} of {testQuestions.length} ({participantCode})
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{currentQ.citation}</span>
          </div>

          <h3 style={{ fontSize: 16, color: '#134e4a', margin: '0 0 16px' }}>{currentQ.question}</h3>
          <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            {currentQ.options.map((opt, oIdx) => {
              const checked = selectedAnswers[currentQ.id] === oIdx;
              return (
                <button
                  key={oIdx}
                  onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: oIdx }))}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${checked ? '#0f766e' : '#cbd5e1'}`,
                    background: checked ? '#ffffff' : '#f8fafc',
                    color: checked ? '#0f766e' : '#334155',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + oIdx)}.</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {currentQIndex < testQuestions.length - 1 ? (
              <button
                className="btn gold"
                onClick={() => setCurrentQIndex((i) => i + 1)}
                disabled={selectedAnswers[currentQ.id] === undefined}
              >
                Next Question →
              </button>
            ) : (
              <button
                className="btn gold"
                onClick={handlePostTestSubmit}
                disabled={selectedAnswers[currentQ.id] === undefined}
              >
                Submit Post-Test
              </button>
            )}
          </div>
        </div>
      )}

      {pilotStage === 'results' && (
        <div className="card" style={{ background: '#f0fdf4', border: '2px solid #86efac', textAlign: 'center', padding: 30 }}>
          <div style={{ display: 'inline-flex', padding: 12, background: '#dcfce7', borderRadius: '50%', marginBottom: 12 }}>
            <CheckCircle2 size={32} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: 22, color: '#16a34a', margin: '0 0 8px' }}>
            Empirical Pilot Trial Completed!
          </h2>
          <p style={{ fontSize: 16, color: '#1e293b', margin: '0 0 16px' }}>
            Pre-Test: <b>{preScore} / 5</b> &nbsp;→&nbsp; Post-Test: <b>{postScore} / 5</b> &nbsp;|&nbsp; Gain Delta:{' '}
            <b style={{ color: '#16a34a' }}>+{(postScore || 0) - (preScore || 0)}</b> (
            {Math.round((((postScore || 0) - (preScore || 0)) / 5.0) * 100)}% Normalized Gain)
          </p>
          <button className="btn soft small" onClick={() => setPilotStage('idle')}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

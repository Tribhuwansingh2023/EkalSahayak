import React, { useState } from 'react';
import { 
  Activity, 
  Brain, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Code2, 
  Cpu, 
  HelpCircle, 
  Network, 
  ShieldAlert, 
  Sparkles, 
  Wrench, 
  X,
  Headphones,
  Mic,
  Volume2,
  Radio
} from 'lucide-react';
import { AgentDecisionTrace } from '../lib/agent-client';

interface AgentTraceInspectorProps {
  traces: AgentDecisionTrace[];
  detectedTopic?: string;
  misconceptionDiagnosed?: string;
  isOffline?: boolean;
  onClose: () => void;
}

export const AgentTraceInspector: React.FC<AgentTraceInspectorProps> = ({
  traces,
  detectedTopic,
  misconceptionDiagnosed,
  isOffline,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'json' | 'architecture' | 'voice'>('timeline');
  const [expandedTrace, setExpandedTrace] = useState<number | null>(0);

  return (
    <aside 
      className="agent-trace-sidebar"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '460px',
        maxWidth: '92vw',
        background: '#131924',
        color: '#e4ecf7',
        borderLeft: '1px solid #233147',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #233147',
          background: '#0d121c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}
          >
            <Brain size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10b981', fontWeight: 700 }}>
              Evaluator / Judge Mode
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
              LangGraph Agent Decision Trace
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Close Inspector"
        >
          <X size={18} />
        </button>
      </div>

      {/* Status Bar */}
      <div 
        style={{
          padding: '10px 20px',
          background: '#1a2332',
          borderBottom: '1px solid #233147',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isOffline ? '#f59e0b' : '#10b981',
              display: 'inline-block',
              boxShadow: isOffline ? '0 0 8px #f59e0b' : '0 0 8px #10b981'
            }} 
          />
          <span style={{ color: '#cbd5e1' }}>
            {isOffline ? 'Offline Edge Fallback Active' : 'LangGraph Core Engine Live'}
          </span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
          Steps: <strong style={{ color: '#38bdf8' }}>{traces.length}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div 
        style={{
          display: 'flex',
          borderBottom: '1px solid #233147',
          background: '#0d121c'
        }}
      >
        <button
          onClick={() => setActiveTab('timeline')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: activeTab === 'timeline' ? '#1e293b' : 'transparent',
            color: activeTab === 'timeline' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTab === 'timeline' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderBottom: activeTab === 'timeline' ? '2px solid #38bdf8' : 'none'
          }}
        >
          <Activity size={14} /> Decision Loop
        </button>
        <button
          onClick={() => setActiveTab('json')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: activeTab === 'json' ? '#1e293b' : 'transparent',
            color: activeTab === 'json' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTab === 'json' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderBottom: activeTab === 'json' ? '2px solid #38bdf8' : 'none'
          }}
        >
          <Code2 size={14} /> Tool Traces
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: activeTab === 'architecture' ? '#1e293b' : 'transparent',
            color: activeTab === 'architecture' ? '#38bdf8' : '#94a3b8',
            fontWeight: activeTab === 'architecture' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderBottom: activeTab === 'architecture' ? '2px solid #38bdf8' : 'none'
          }}
        >
          <Network size={14} /> Rubric Defense
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            background: activeTab === 'voice' ? '#1e293b' : 'transparent',
            color: activeTab === 'voice' ? '#f59e0b' : '#94a3b8',
            fontWeight: activeTab === 'voice' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderBottom: activeTab === 'voice' ? '2px solid #f59e0b' : 'none'
          }}
          data-testid="tab-voice-engine"
        >
          <Headphones size={14} /> Voice Engine
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeTab === 'timeline' && (
          <div>
            {/* Context Card */}
            <div 
              style={{
                background: '#1a2332',
                border: '1px solid #233147',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px'
              }}
            >
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                Curriculum Alignment
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                  {detectedTopic ? `Odisha Board: ${detectedTopic}` : 'Class 9 Science'}
                </span>
                <span style={{ background: '#0284c7', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>
                  BSE Odisha
                </span>
              </div>
              {misconceptionDiagnosed && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#fbbf24', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ShieldAlert size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>Diagnosed Misconception: {misconceptionDiagnosed}</span>
                </div>
              )}
            </div>

            {/* Steps Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {traces.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '13px' }}>
                  Ask a question or tap a quick doubt to see the live LangGraph execution trace.
                </div>
              ) : (
                traces.map((trace, idx) => {
                  const isExpanded = expandedTrace === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#1e293b',
                        borderRadius: '8px',
                        border: isExpanded ? '1px solid #38bdf8' : '1px solid #334155',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <button
                        onClick={() => setExpandedTrace(isExpanded ? null : idx)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'transparent',
                          border: 'none',
                          color: '#f8fafc',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span 
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#0f172a',
                              border: '1px solid #38bdf8',
                              color: '#38bdf8',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                              {trace.step_name.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Node: <code>{trace.node}</code>
                            </div>
                          </div>
                        </div>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 14px 14px 14px', borderTop: '1px solid #334155', fontSize: '12px' }}>
                          {/* Agent Thought */}
                          <div style={{ marginTop: '10px' }}>
                            <div style={{ color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Brain size={13} /> Agent Thought:
                            </div>
                            <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', lineHeight: '1.4' }}>
                              "{trace.thought}"
                            </p>
                          </div>

                          {/* Tool Invoked */}
                          {trace.tool_called && (
                            <div style={{ marginTop: '10px', background: '#0f172a', padding: '8px 10px', borderRadius: '6px' }}>
                              <div style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Wrench size={13} /> Tool Called:
                              </div>
                              <code style={{ color: '#34d399', fontSize: '11px' }}>
                                {trace.tool_called}
                              </code>
                              {trace.tool_args && (
                                <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '11px' }}>
                                  Args: {JSON.stringify(trace.tool_args)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Decision Rationale */}
                          <div style={{ marginTop: '10px' }}>
                            <div style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Sparkles size={13} /> Decision Rationale:
                            </div>
                            <p style={{ margin: '4px 0 0 0', color: '#e2e8f0', lineHeight: '1.4' }}>
                              {trace.decision_rationale}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'json' && (
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
              Full tool invocation payloads and observations sent through the LangGraph state channel:
            </div>
            <pre 
              style={{
                background: '#090d16',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #1e293b',
                color: '#38bdf8',
                fontSize: '11px',
                overflowX: 'auto',
                lineHeight: '1.5'
              }}
            >
              {JSON.stringify(traces, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#cbd5e1' }}>
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Why Deterministic State Graph?
              </div>
              <p style={{ margin: 0, fontSize: '12px' }}>
                <strong>Hackathon Evaluation Question:</strong> <em>"Why deterministic or autonomous, and what would break if you chose the other?"</em>
              </p>
              <p style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                <strong>Our Answer:</strong> An unconstrained autonomous agent (like standard ReAct) in rural Class 9 education poses critical risks: hallucinations in core physics definitions, loop traps on intermittent connectivity, and erratic tool sequences. 
              </p>
              <p style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                Our <strong>LangGraph Deterministic Workflow</strong> enforces strict pedagogical scaffolding: (1) Prerequisite check → (2) Misconception remediation → (3) Cultural Odia analogy → (4) Formative micro-quiz → (5) Autonomous next-day followup.
              </p>
            </div>

            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, color: '#10b981', marginBottom: '6px' }}>
                Offline Fallback Guarantee
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                When Wi-Fi is severed live on stage, the exact same state graph and tool sequence runs locally in client memory with zero network delay, queueing follow-ups in IndexedDB.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#cbd5e1' }}>
            {/* Voice Architecture Overview */}
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Headphones size={16} /> Vernacular Voice Layer Overview
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Lakshya studies on a shared low-end 5-inch smartphone screen. Reading dense scientific Odia paragraphs (with complex conjunct characters / ଯୁକ୍ତାକ୍ଷର) creates high cognitive fatigue. Audio-first learning allows them to listen comfortably while following sentence highlights.
              </p>
            </div>

            {/* STT Pipeline Card */}
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic size={15} /> 1. Speech-to-Text (STT) Architecture
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '12px' }}>
                <div style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Primary Engine</div>
                  <strong style={{ color: '#f8fafc' }}>Bhashini (ULCA / AI4Bharat) + Whisper Indic ASR</strong>
                </div>
                <div style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Browser Edge Engine</div>
                  <strong style={{ color: '#f8fafc' }}>Web Speech API (or-IN / Odia) with Interim Streaming</strong>
                </div>
                <div style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Offline Acoustic Matcher</div>
                  <span style={{ color: '#10b981' }}>Keyword Trigger Bank (e.g. ମାଟି ମାଠିଆ, ବାଷ୍ପୀଭବନ, ଲୀନ ତାପ)</span>
                </div>
              </div>
            </div>

            {/* TTS Pipeline Card */}
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 600, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Volume2 size={15} /> 2. Audio Playback (TTS) Pipeline
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>
                Browsers lack native Odia TTS voices. Our pipeline dynamically transliterates Odia Unicode (0x0B00..0x0B7F) into Indic Brahmi phonetics (Devanagari 0x0900..0x097F), passing it to Indic acoustic models for authentic pronunciation.
              </p>
              <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px' }}>
                <div style={{ color: '#fbbf24' }}>// Phonetic Mapping Sample:</div>
                <div style={{ color: '#94a3b8', marginTop: '3px' }}>Odia: ମାଟି ମାଠିଆରେ ପାଣି ଥଣ୍ଡା ରହେ</div>
                <div style={{ color: '#38bdf8' }}>Indic: माटि माठिआरे पाणि थण्डा रहे</div>
                <div style={{ color: '#10b981', marginTop: '4px' }}>Stream: 41.5 KB / 128kbps MP3 · In-Memory LRU Cached</div>
              </div>
            </div>

            {/* Read-Along Karaoke Scaffolding */}
            <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} style={{ color: '#fbbf24' }} /> 3. Pedagogical Read-Along Scaffolding
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#94a3b8' }}>
                <li>Sentence-by-sentence karaoke highlighting syncs visual words to spoken audio.</li>
                <li>Lakshya can click any individual sentence to replay just that part.</li>
                <li>0.75× speed option assists with challenging scientific terms.</li>
                <li>Zero-data fallback to SpeechSynthesisUtterance when offline.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div 
        style={{
          padding: '12px 20px',
          background: '#0d121c',
          borderTop: '1px solid #233147',
          fontSize: '11px',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>Framework: LangGraph 0.1+</span>
        <span>Persona: Lakshya (Class 9)</span>
      </div>
    </aside>
  );
};

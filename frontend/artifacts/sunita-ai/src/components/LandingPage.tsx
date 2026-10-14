import React from 'react';
import { 
  Brain, 
  Sparkles, 
  Volume2, 
  Mic, 
  CloudOff, 
  Zap, 
  Users, 
  BookOpen, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  Activity, 
  FlaskConical, 
  GraduationCap, 
  Target, 
  Radio, 
  Lock, 
  UserCheck, 
  LogOut,
  Smartphone
} from 'lucide-react';
import { AuthUser } from '../lib/auth-service';

interface LandingPageProps {
  currentUser: AuthUser | null;
  onGetStarted: () => void;
  onLogin: () => void;
  onGoToDashboard: () => void;
  onOpenTraceInspector: () => void;
  onLogout: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  onGetStarted,
  onLogin,
  onGoToDashboard,
  onOpenTraceInspector,
  onLogout
}) => {
  const quickDoubts = [
    {
      emoji: '🍵',
      topic: 'Evaporation vs Boiling',
      titleOdia: 'ମାଟି ମାଠିଆରେ ପାଣି କାହିଁକି ଥଣ୍ଡା ରହେ? ପାଣି କଣ ୧୦୦ ଡିଗ୍ରୀରେ ଫୁଟୁଛି?',
      chapter: 'BSE Odisha Class 9 · Chapter 1: Matter in Our Surroundings',
      tag: 'Latent Heat & Cooling'
    },
    {
      emoji: '🍚',
      topic: 'Latent Heat of Vaporization',
      titleOdia: 'ଫୁଟୁଥିବା ପାଣି ଅପେକ୍ଷା ଭାତ ହାଣ୍ଡିର ବାଷ୍ପ କାହିଁକି ଅଧିକ ପୋଡ଼ିଥାଏ?',
      chapter: 'BSE Odisha Class 9 · Chapter 1: ଲୀନ ତାପ',
      tag: 'Heat Transfer'
    },
    {
      emoji: '🔬',
      topic: 'Cell Biology',
      titleOdia: 'କୋଷର ଶକ୍ତି କେନ୍ଦ୍ର (Powerhouse of the Cell) ବୋଲି କାହାକୁ କୁହାଯାଏ?',
      chapter: 'BSE Odisha Class 9 · Chapter 5: Fundamental Unit of Life',
      tag: 'Mitochondria & ATP'
    },
    {
      emoji: '🏃',
      topic: 'Motion & Displacement',
      titleOdia: 'ବସ୍ତୁଟି ଘରୁ ବାହାରି ପୁଣି ଘରକୁ ଫେରିଲେ ବିସ୍ଥାପନ (Displacement) କାହିଁକି ଶୂନ୍ୟ ହୁଏ?',
      chapter: 'BSE Odisha Class 9 · Chapter 8: Motion',
      tag: 'Vectors & Distance'
    }
  ];

  const modules = [
    {
      icon: Mic,
      color: 'from-amber-500 to-orange-500',
      tag: 'Vernacular Audio',
      title: 'Voice-First Odia AI Tutor',
      titleOdia: 'ମାତୃଭାଷା ଓଡ଼ିଆରେ କଥୋପକଥନ ଓ ଶିକ୍ଷାଦାନ',
      desc: 'Eliminates screen fatigue on low-cost smartphones. Real-time Odia speech recognition (or-IN), authentic Indic phonetic speech synthesis, and sentence-by-sentence karaoke highlighting.'
    },
    {
      icon: Brain,
      color: 'from-emerald-500 to-teal-500',
      tag: 'LangGraph Core',
      title: 'Deterministic State Graph Agent',
      titleOdia: 'ନିର୍ଭୁଲ ଶିକ୍ଷା ପଦ୍ଧତି (Zero Hallucination)',
      desc: 'Pedagogy requires precision. The LangGraph state machine diagnoses prerequisites, detects misconceptions, and anchors science concepts in lived rural context (ମାଟି ମାଠିଆ, ଭାତ ହାଣ୍ଡି).'
    },
    {
      icon: CloudOff,
      color: 'from-cyan-500 to-blue-500',
      tag: 'Edge Offline First',
      title: '100% Zero-Data Offline Operation',
      titleOdia: 'ବିନା ଇଣ୍ଟରନେଟ୍ ରେ ସମ୍ପୂର୍ଣ୍ଣ ଶିକ୍ଷା (IndexedDB)',
      desc: 'Ultra-lightweight BSE Odisha curriculum bundles cached locally in IndexedDB. Students ask doubts and take quizzes offline; events auto-sync once internet connectivity returns.'
    },
    {
      icon: Zap,
      color: 'from-amber-400 to-yellow-500',
      tag: 'Real-Time WebSocket',
      title: 'Live Questionnaire Engine',
      titleOdia: 'ରିଅଲ-ଟାଇମ୍ କୁଇଜ୍ ଓ ପ୍ରତିଯୋଗିତା',
      desc: 'High-performance interactive quizzes with 30-second timers, streak multipliers, pedagogical hints, and instant mastery graph updates directly persisted into MongoDB.'
    },
    {
      icon: Users,
      color: 'from-purple-500 to-indigo-500',
      tag: 'Community & Parents',
      title: 'Teacher Radar & Low-Bandwidth SMS',
      titleOdia: 'ଶିକ୍ଷକ ଡ୍ୟାସବୋର୍ଡ ଓ ଅଭିଭାବକ SMS ସୂଚନା',
      desc: 'Classroom misconception radar flagging common conceptual traps, combined with 1-click low-bandwidth SMS updates for parents with basic feature phones.'
    }
  ];

  return (
    <div className="landing-container" style={{ minHeight: '100vh', background: '#0b101b', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Navigation */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(11, 16, 27, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f172a',
            fontWeight: 900,
            fontSize: '22px',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)'
          }}>
            ଏ
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                EkalSahayak
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                ଏକଲ ସହାୟକ
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              BSE Odisha Class 9 & 10 Science · Vernacular AI
            </div>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="hidden-mobile">
          <a href="#features" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
            Features
          </a>
          <a href="#doubts" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
            Science Doubts
          </a>
          <a href="#architecture" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
            Architecture
          </a>
          <button 
            onClick={onOpenTraceInspector}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Brain size={14} /> Judge Mode Trace
          </button>
        </nav>

        {/* Auth CTA Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '6px 12px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px'
              }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f59e0b', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                  {currentUser.name.slice(0, 1)}
                </div>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{currentUser.name}</span>
                <span style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                  Class {currentUser.grade}
                </span>
              </div>

              <button
                onClick={onGoToDashboard}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#0f172a',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                }}
                data-testid="btn-landing-dashboard"
              >
                <span>Dashboard</span>
                <ArrowRight size={15} />
              </button>

              <button
                onClick={onLogout}
                title="Log Out"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={onLogin}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f1f5f9',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                data-testid="btn-landing-login"
              >
                ପ୍ରବେଶ (Login)
              </button>

              <button
                onClick={onGetStarted}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#0f172a',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
                  transition: 'transform 0.2s'
                }}
                data-testid="btn-landing-get-started"
              >
                <Sparkles size={15} />
                <span>Get Started / ଆରମ୍ଭ କରନ୍ତୁ</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '70px 24px 60px',
        maxWidth: '1200px',
        margin: '0 auto',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Glow backdrop */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '350px',
          background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.15), rgba(16, 185, 129, 0.05), transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '20px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>🏛️ BSE Odisha Class 9 & 10 Science · Regional Vernacular AI Education</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 5.5vw, 56px)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: '#f8fafc',
            maxWidth: '920px',
            margin: '0 auto 16px'
          }}>
            Voice-First, Offline AI Learning Companion for Rural Odisha
          </h1>

          <p className="odia-font" style={{
            fontSize: 'clamp(18px, 3vw, 26px)',
            fontWeight: 700,
            color: '#fbbf24',
            marginBottom: '20px'
          }}>
            ଓଡ଼ିଶାର ଗ୍ରାମାଞ୍ଚଳ ଓ ଆଦିବାସୀ ଛାତ୍ରଛାତ୍ରୀଙ୍କ ପାଇଁ ପ୍ରଥମ ସ୍ୱଦେଶୀ AI ଶିକ୍ଷା ସାଥୀ
          </p>

          <p style={{
            fontSize: '16px',
            lineHeight: 1.6,
            color: '#94a3b8',
            maxWidth: '750px',
            margin: '0 auto 34px'
          }}>
            Bilingual science tutoring in spoken Odia, deterministic LangGraph pedagogical reasoning that eliminates hallucinations, 100% zero-data offline capability in IndexedDB, and real-time live WebSocket quizzes.
          </p>

          {/* Hero CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {currentUser ? (
              <button
                onClick={onGoToDashboard}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#0f172a',
                  border: 'none',
                  padding: '14px 32px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(245, 158, 11, 0.4)'
                }}
              >
                <span>Continue Learning as {currentUser.name}</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <>
                <button
                  onClick={onGetStarted}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#0f172a',
                    border: 'none',
                    padding: '14px 32px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 6px 24px rgba(245, 158, 11, 0.4)'
                  }}
                  data-testid="hero-get-started"
                >
                  <Sparkles size={18} />
                  <span>Get Started (ଶିକ୍ଷା ଆରମ୍ଭ କରନ୍ତୁ)</span>
                </button>

                <button
                  onClick={onLogin}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#f8fafc',
                    padding: '14px 26px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                  data-testid="hero-login"
                >
                  <Lock size={16} />
                  <span>Login to Account (ପ୍ରବେଶ)</span>
                </button>
              </>
            )}

            <button
              onClick={onOpenTraceInspector}
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                padding: '14px 24px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
              data-testid="hero-judge-trace"
            >
              <Brain size={18} />
              <span>Inspect Agent Brain (Judge Mode)</span>
            </button>
          </div>

          {/* Quick Pillars Badges */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            marginTop: '45px',
            flexWrap: 'wrap',
            padding: '16px 24px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            maxWidth: '860px',
            margin: '45px auto 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
              <span style={{ color: '#10b981' }}>🟢</span> <b>LangGraph State Machine</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
              <span style={{ color: '#38bdf8' }}>📶</span> <b>100% Offline in IndexedDB</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
              <span style={{ color: '#fbbf24' }}>🎙️</span> <b>Odia Voice & Karaoke</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
              <span style={{ color: '#f43f5e' }}>⚡</span> <b>WebSocket Live Quizzes</b>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Modules */}
      <section id="features" style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '45px' }}>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', fontWeight: 800 }}>
            Comprehensive Architecture
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            Engineered for Rural Odisha's Reality
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '600px', margin: '8px auto 0' }}>
            Built specifically to solve 2G intermittent connectivity, shared 1-hour smartphone windows, and complex scientific Odia reading fatigue.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {modules.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div 
                key={idx}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '18px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.08))`,
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fbbf24'
                  }}>
                    <Icon size={22} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {m.tag}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                    {m.title}
                  </h3>
                  <div className="odia-font" style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>
                    {m.titleOdia}
                  </div>
                  <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#94a3b8' }}>
                    {m.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Curated Odia Doubts Preview Showcase */}
      <section id="doubts" style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981', fontWeight: 800 }}>
            Curriculum Grounding
          </span>
          <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            Real Science Doubts in Spoken Odia
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '600px', margin: '6px auto 0' }}>
            Anchored in rural Odisha’s daily lived experience. Click any question to explore the explanation inside the platform.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {quickDoubts.map((d, i) => (
            <div 
              key={i}
              onClick={() => {
                if (currentUser) {
                  onGoToDashboard();
                } else {
                  onGetStarted();
                }
              }}
              style={{
                background: '#131b2c',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px'
              }}
              data-testid={`card-doubt-${i}`}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '26px' }}>{d.emoji}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    {d.tag}
                  </span>
                </div>
                <h4 className="odia-font" style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.4, marginBottom: '8px' }}>
                  {d.titleOdia}
                </h4>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {d.chapter}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>
                <span>{currentUser ? 'Solve on Dashboard' : 'Ask Question (Get Started)'}</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works / 3 Easy Steps */}
      <section style={{ padding: '70px 24px', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#f8fafc', marginBottom: '35px' }}>
          How It Works in 3 Simple Steps
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#f59e0b', color: '#0f172a', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              1
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
              Create Your Account
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Quick 10-second registration with your name and class. Persistent learning profile saved into MongoDB.
            </p>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#10b981', color: '#0f172a', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              2
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
              Ask Doubts in Spoken Odia
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Speak into the microphone. Receive sentence-by-sentence read-along audio explanations that clarify misconceptions.
            </p>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              3
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
              Master with Live Quizzes
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Participate in real-time WebSocket speed quizzes, earn achievement badges, and track your concept mastery.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section style={{
        padding: '50px 24px',
        maxWidth: '1000px',
        margin: '0 auto 60px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '24px',
        textAlign: 'center',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', marginBottom: '10px' }}>
          Ready to Start Your Science Learning Journey?
        </h2>
        <p className="odia-font" style={{ fontSize: '18px', color: '#fbbf24', marginBottom: '25px', fontWeight: 600 }}>
          ଆଜି ହିଁ ନିଜ ଖାତା ତିଆରି କରନ୍ତୁ ଏବଂ ଓଡ଼ିଆରେ ବିଜ୍ଞାନ ଶିଖନ୍ତୁ
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {currentUser ? (
            <button
              onClick={onGoToDashboard}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#0f172a',
                border: 'none',
                padding: '14px 34px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <span>Go to Your Learning Dashboard</span>
              <ArrowRight size={18} />
            </button>
          ) : (
            <>
              <button
                onClick={onGetStarted}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#0f172a',
                  border: 'none',
                  padding: '14px 34px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(245, 158, 11, 0.4)'
                }}
                data-testid="bottom-cta-register"
              >
                <Sparkles size={18} />
                <span>Get Started Now (ନୂତନ ଖାତା ଖୋଲନ୍ତୁ)</span>
              </button>

              <button
                onClick={onLogin}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '14px 26px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
                data-testid="bottom-cta-login"
              >
                ପ୍ରବେଶ (Login)
              </button>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#64748b',
        background: '#090d16'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
          <b>EkalSahayak (ଏକଲ ସହାୟକ)</b> · BSE Odisha Class 9 & 10 Science
        </div>
        <div>
          Powered by LangGraph Deterministic State Machine · MongoDB Atlas · Edge Offline First in IndexedDB
        </div>
      </footer>
    </div>
  );
};

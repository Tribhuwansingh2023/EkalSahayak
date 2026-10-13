import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, Sparkles, Gauge, Radio, CheckCircle, Headphones } from 'lucide-react';
import { fetchTTSAudio } from '../lib/agent-client';

interface OdiaAudioPlayerProps {
  text: string;
  spokenScript?: string;
  conceptTitle?: string;
  isOffline?: boolean;
  onSentenceChange?: (sentenceIndex: number) => void;
}

export const OdiaAudioPlayer: React.FC<OdiaAudioPlayerProps> = ({
  text,
  spokenScript,
  conceptTitle,
  isOffline = false,
  onSentenceChange
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const [speed, setSpeed] = useState<number>(1.0);
  const [engine, setEngine] = useState<'indic_natural' | 'web_speech'>('indic_natural');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [cachedBlobUrl, setCachedBlobUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  // Script to speak: prefers audio_spoken_script if available, else falls back to text
  const scriptToSpeak = spokenScript || text;

  // Split text into readable sentences for read-along karaoke highlighting
  // Odia sentences end with danda '।', '?', '!', or newline
  const sentences = React.useMemo(() => {
    if (!text) return [];
    return text
      .split(/(?<=[।?!.\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }, [text]);

  // Clean up audio URL and speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (cachedBlobUrl) {
        URL.revokeObjectURL(cachedBlobUrl);
      }
    };
  }, []);

  // Update playback speed if audio is already loaded
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Handle Play via Server Indic MP3 Stream or Web Speech
  const startPlayback = async (sentenceIdx: number = 0) => {
    const textTarget = sentenceIdx >= 0 && sentenceIdx < sentences.length
      ? sentences[sentenceIdx]
      : scriptToSpeak;

    // If already playing, stop current
    stopPlayback();

    // Strategy 1: If online and Indic Natural engine selected, stream MP3 from backend
    if (!isOffline && engine === 'indic_natural') {
      try {
        setLoading(true);
        let blobUrl = cachedBlobUrl;

        // If no cached blob for the full script or playing a single sentence
        if (!blobUrl || sentenceIdx >= 0) {
          const blob = await fetchTTSAudio(textTarget, speed < 0.9, 'indic_natural');
          blobUrl = URL.createObjectURL(blob);
          if (sentenceIdx === -1) {
            setCachedBlobUrl(blobUrl);
          }
        }

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.src = blobUrl;
        audio.playbackRate = speed;
        audio.muted = muted;

        audio.onloadedmetadata = () => {
          setDuration(audio.duration || 12);
        };

        audio.ontimeupdate = () => {
          setCurrentTime(audio.currentTime);
          if (audio.duration && sentences.length > 0 && sentenceIdx === -1) {
            const progress = audio.currentTime / audio.duration;
            const currentIdx = Math.min(
              sentences.length - 1,
              Math.floor(progress * sentences.length)
            );
            setActiveSentenceIndex(currentIdx);
            onSentenceChange?.(currentIdx);
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setActiveSentenceIndex(-1);
          setCurrentTime(0);
        };

        await audio.play();
        setIsPlaying(true);
        setActiveSentenceIndex(sentenceIdx >= 0 ? sentenceIdx : 0);
        setLoading(false);
        return;
      } catch (err) {
        console.warn('Backend TTS stream failed, seamlessly falling back to Web Speech API:', err);
        setEngine('web_speech');
        setLoading(false);
      }
    }

    // Strategy 2: Web Speech Synthesis API Fallback (Zero Data / Offline Edge Mode)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textTarget);
      utterance.lang = 'or-IN';
      utterance.rate = speed;

      utterance.onstart = () => {
        setIsPlaying(true);
        setActiveSentenceIndex(sentenceIdx >= 0 ? sentenceIdx : 0);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setActiveSentenceIndex(-1);
      };

      utterance.onerror = () => {
        setIsPlaying(false);
        setActiveSentenceIndex(-1);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setActiveSentenceIndex(-1);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(-1);
    }
  };

  const playSentence = (idx: number) => {
    startPlayback(idx);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      className="odia-audio-player-card"
      style={{
        background: 'linear-gradient(135deg, #fdfbf7 0%, #f4ede1 100%)',
        border: '2px solid #e2d2b5',
        borderRadius: '20px',
        padding: '20px',
        marginTop: '16px',
        boxShadow: '0 8px 24px rgba(138, 92, 38, 0.08)'
      }}
      data-testid="odia-audio-player"
    >
      {/* Header bar with Mode Badge & Accessibility Note */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              background: '#efbd4e', 
              display: 'grid', 
              placeItems: 'center', 
              color: '#342914',
              boxShadow: '0 3px 0 #cf9c34'
            }}
          >
            <Headphones size={20} />
          </div>
          <div>
            <b className="odia-font" style={{ fontSize: '16px', color: '#322515', display: 'block' }}>
              🔊 ସୁନିତା ଶୁଣିବା ପାଇଁ ଅଡିଓ (Voice Explanation Player)
            </b>
            <span style={{ fontSize: '11px', color: '#7a6850' }}>
              ଛୋଟ ସ୍କ୍ରିନରେ ବଡ଼ ଅନୁଚ୍ଛେଦ ନ ପଢ଼ି ନିଜ ମାତୃଭାଷାରେ ଶୁଣନ୍ତୁ
            </span>
          </div>
        </div>

        {/* Engine switcher pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setEngine(engine === 'indic_natural' ? 'web_speech' : 'indic_natural')}
            style={{
              background: engine === 'indic_natural' ? '#e0f2fe' : '#fef3c7',
              color: engine === 'indic_natural' ? '#0369a1' : '#b45309',
              border: `1px solid ${engine === 'indic_natural' ? '#7dd3fc' : '#fcd34d'}`,
              borderRadius: '12px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Switch TTS voice synthesizer engine"
            data-testid="button-toggle-tts-engine"
          >
            <Radio size={12} />
            <span>{engine === 'indic_natural' ? '🎙️ Indic Natural Stream' : '⚡ Web Speech (Zero-Data)'}</span>
          </button>
        </div>
      </div>

      {/* Primary Audio Control Bar */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '14px 18px',
          border: '1px solid #ebd9c0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          flexWrap: 'wrap'
        }}
      >
        {/* Big Touch-Friendly Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={loading}
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: isPlaying ? '#dc2626' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            boxShadow: isPlaying ? '0 4px 12px rgba(220, 38, 38, 0.3)' : '0 4px 14px rgba(16, 185, 129, 0.35)',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title={isPlaying ? 'Pause' : 'Play Odia Spoken Explanation'}
          data-testid="button-audio-play-toggle"
        >
          {loading ? (
            <Sparkles size={24} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={26} />
          ) : (
            <Play size={26} style={{ marginLeft: '3px' }} />
          )}
        </button>

        {/* Replay Button */}
        <button
          type="button"
          onClick={() => startPlayback(0)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#475569',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer'
          }}
          title="Restart audio from beginning"
          data-testid="button-audio-restart"
        >
          <RotateCcw size={18} />
        </button>

        {/* Progress Bar & Wave Equalizer */}
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600 }}>
              {isPlaying ? '🔊 ଶୁଣୁଛନ୍ତି (Listening)...' : 'ଶୁଣିବା ପାଇଁ ପ୍ଲେ କରନ୍ତୁ'}
            </span>
            <span>{formatTime(currentTime)} / {formatTime(duration || 12)}</span>
          </div>

          {/* Equalizer animation bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '24px', margin: '4px 0' }}>
            {Array.from({ length: 24 }, (_, i) => {
              const heights = [8, 14, 20, 16, 10, 22, 18, 12, 24, 14, 8, 19, 23, 11, 15, 21, 13, 9, 17, 22, 12, 16, 20, 10];
              const h = heights[i % heights.length];
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: isPlaying ? `${h}px` : '4px',
                    borderRadius: '4px',
                    background: isPlaying ? (i % 2 === 0 ? '#10b981' : '#f59e0b') : '#cbd5e1',
                    transition: 'height 0.2s ease',
                    opacity: isPlaying ? 1 : 0.4
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Speed Controls: 0.75x, 1x, 1.25x */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Gauge size={14} style={{ color: '#64748b', marginRight: '2px' }} />
          {[0.75, 1.0, 1.25].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              style={{
                background: speed === s ? '#0f172a' : '#f1f5f9',
                color: speed === s ? '#ffffff' : '#334155',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title={`Set playback speed to ${s}x`}
              data-testid={`button-speed-${s}`}
            >
              {s === 0.75 ? '0.75× ଧୀରେ' : s === 1.0 ? '1.0×' : '1.25×'}
            </button>
          ))}
        </div>
      </div>

      {/* Sentence-by-Sentence Read-Along (Karaoke Highlighter) */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#634b29' }}>
            📖 ଶବ୍ଦ ଅନୁକ୍ରମଣିକା (Tap Any Sentence to Listen):
          </span>
          <span style={{ fontSize: '11px', color: '#8c785d' }}>
            {sentences.length} sentences
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sentences.map((sent, idx) => {
            const isActive = activeSentenceIndex === idx;
            return (
              <div
                key={idx}
                onClick={() => playSentence(idx)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: isActive ? '#fef3c7' : '#ffffff',
                  border: isActive ? '2px solid #f59e0b' : '1px solid #e7ded0',
                  boxShadow: isActive ? '0 4px 12px rgba(245, 158, 11, 0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
                title="Click to play this sentence"
                data-testid={`karaoke-sentence-${idx}`}
              >
                <div 
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: isActive ? '#f59e0b' : '#f1ede4',
                    color: isActive ? '#ffffff' : '#685947',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  {isActive ? <Volume2 size={13} /> : idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p 
                    className="odia-font" 
                    style={{ 
                      fontSize: '15px', 
                      lineHeight: '1.6', 
                      margin: 0,
                      color: isActive ? '#78350f' : '#292524',
                      fontWeight: isActive ? 600 : 400
                    }}
                  >
                    {sent}
                  </p>
                  {isActive && (
                    <span 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '11px', 
                        color: '#b45309', 
                        fontWeight: 600, 
                        marginTop: '4px' 
                      }}
                    >
                      🔊 ବର୍ତ୍ତମାନ ପଢ଼ାଯାଉଛି (Currently Reading)...
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

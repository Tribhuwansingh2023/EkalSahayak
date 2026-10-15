import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Users,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ensureAuthenticatedSession } from '@/lib/auth-service';

export interface GradeCommandOverview {
  grade_id: number;
  grade_label: string;
  current_activity: {
    name: string | null;
    status: 'Not Started' | 'In Progress' | 'Completed' | string;
    progress_percent: number | null;
  };
  assessment: {
    has_data: boolean;
    students_needing_support: number | null;
    support_status_text: string;
    concepts_requiring_revision: string[];
    average_progress: number | null;
  };
  enrolled_student_count: number;
  is_demo: boolean;
}

interface CommandData {
  title: string;
  subtitle: string;
  grades: GradeCommandOverview[];
}

interface ClassroomCommandCenterProps {
  setPath: (path: string) => void;
}

const FALLBACK_GRADES: GradeCommandOverview[] = [
  {
    grade_id: 3,
    grade_label: 'Grade 3',
    current_activity: {
      name: 'Foundational Numeracy: Place Value & Grouping',
      status: 'In Progress',
      progress_percent: 65,
    },
    assessment: {
      has_data: true,
      students_needing_support: 1,
      support_status_text: '1 student needing support',
      concepts_requiring_revision: ['2-digit Place Value Grouping'],
      average_progress: 72,
    },
    enrolled_student_count: 4,
    is_demo: true,
  },
  {
    grade_id: 4,
    grade_label: 'Grade 4',
    current_activity: {
      name: 'Environmental Studies: Plants & Root Systems',
      status: 'Completed',
      progress_percent: 100,
    },
    assessment: {
      has_data: true,
      students_needing_support: 2,
      support_status_text: '2 students needing support',
      concepts_requiring_revision: ['Fibrous vs Taproots', 'Leaf Venation Functions'],
      average_progress: 62,
    },
    enrolled_student_count: 5,
    is_demo: true,
  },
  {
    grade_id: 5,
    grade_label: 'Grade 5',
    current_activity: {
      name: 'Science: States of Matter & Water Cycle',
      status: 'Not Started',
      progress_percent: 0,
    },
    assessment: {
      has_data: false,
      students_needing_support: null,
      support_status_text: 'Assessment pending',
      concepts_requiring_revision: [],
      average_progress: null,
    },
    enrolled_student_count: 6,
    is_demo: true,
  },
];

export function ClassroomCommandCenter({ setPath }: ClassroomCommandCenterProps) {
  const [data, setData] = useState<CommandData>({
    title: 'Classroom Command Center',
    subtitle: 'Monitor learning activities and support needs across all grades.',
    grades: FALLBACK_GRADES,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCommandData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/teacher/command-center', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.grades && json.grades.length > 0) {
          setData(json);
        }
      } else {
        // Fall back gracefully to local multi-grade structure
        console.warn('Command center response not ok, using local multi-grade data');
      }
    } catch (err: any) {
      console.warn('Network issue fetching command center, using cached data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommandData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <span
            className="tag teal"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
          >
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case 'In Progress':
        return (
          <span
            className="tag gold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
          >
            <Clock size={12} /> In Progress
          </span>
        );
      case 'Not Started':
      default:
        return (
          <span
            className="tag"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#ede8de',
              color: '#6c6559',
              fontWeight: 700,
            }}
          >
            <AlertCircle size={12} /> Not Started
          </span>
        );
    }
  };

  return (
    <section
      className="card"
      style={{
        border: '1.5px solid #d4cbb8',
        borderRadius: 22,
        padding: '20px 22px',
        background: '#fffdf9',
        boxShadow: '0 4px 18px rgba(67, 58, 35, 0.04)',
      }}
      data-testid="classroom-command-center"
      aria-label="Classroom Command Center"
    >
      {/* Header section with Title and Subtitle */}
      <div
        className="card-heading"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: '#176b63',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <GraduationCap size={16} />
            </span>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#134e4a', margin: 0 }}>
              {data.title || 'Classroom Command Center'}
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6d675b', lineHeight: 1.4 }}>
            {data.subtitle || 'Monitor learning activities and support needs across all grades.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchCommandData}
            className="btn small soft"
            style={{ padding: '6px 10px', fontSize: 12, minHeight: 32 }}
            title="Refresh Command Center Data"
            disabled={loading}
            data-testid="btn-refresh-command-center"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error state banner if any */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            color: '#991b1b',
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Responsive 3-Grade Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
        data-testid="command-center-grades-grid"
      >
        {data.grades.map((grade) => {
          const act = grade.current_activity;
          const asm = grade.assessment;

          return (
            <div
              key={grade.grade_id}
              className="card"
              style={{
                background: '#ffffff',
                border: '1.5px solid #ded6c5',
                borderRadius: 16,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                position: 'relative',
              }}
              data-testid={`grade-card-${grade.grade_id}`}
            >
              <div>
                {/* Grade Card Top Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: '#f4ede1',
                        border: '1px solid #e2d7c3',
                        color: '#155c53',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      {grade.grade_id}
                    </div>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#193e3a',
                        }}
                      >
                        {grade.grade_label}
                      </h3>
                      <span style={{ fontSize: 11, color: '#787163' }}>
                        {grade.enrolled_student_count} Students Enrolled
                      </span>
                    </div>
                  </div>

                  {grade.is_demo && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                        padding: '2px 7px',
                        borderRadius: 999,
                      }}
                      title="Demonstration cohort data"
                    >
                      Demo data
                    </span>
                  )}
                </div>

                {/* 1. Current Learning Activity */}
                <div
                  style={{
                    background: '#faf7f0',
                    border: '1px solid #ede4d2',
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#847b6e',
                      }}
                    >
                      Current Activity
                    </span>
                    {getStatusBadge(act?.status || 'Not Started')}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: act?.name ? '#1e293b' : '#94a3b8',
                      lineHeight: 1.35,
                    }}
                  >
                    {act?.name || 'No active activity'}
                  </div>

                  {act?.progress_percent !== null && act?.progress_percent !== undefined && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          color: '#71695c',
                          marginBottom: 3,
                        }}
                      >
                        <span>Activity Completion</span>
                        <b>{act.progress_percent}%</b>
                      </div>
                      <div className="progress-track" style={{ height: 6 }}>
                        <i
                          style={{
                            width: `${Math.min(100, Math.max(0, act.progress_percent))}%`,
                            background: act.status === 'Completed' ? '#155c53' : '#e4aa37',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Students Needing Support & Concepts */}
                <div
                  style={{
                    background: asm.has_data ? (asm.students_needing_support && asm.students_needing_support > 0 ? '#fff8f6' : '#f0fdf4') : '#f8fafc',
                    border: `1px solid ${asm.has_data ? (asm.students_needing_support && asm.students_needing_support > 0 ? '#fed7aa' : '#bbf7d0') : '#e2e8f0'}`,
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: asm.has_data ? (asm.students_needing_support && asm.students_needing_support > 0 ? '#9a3412' : '#166534') : '#64748b',
                      }}
                    >
                      Support Needs
                    </span>
                    {asm.has_data ? (
                      asm.students_needing_support && asm.students_needing_support > 0 ? (
                        <span
                          className="tag red"
                          style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                        >
                          {asm.students_needing_support} Need Support
                        </span>
                      ) : (
                        <span
                          className="tag teal"
                          style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                        >
                          All on track
                        </span>
                      )
                    ) : (
                      <span
                        className="tag"
                        style={{
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#f1f5f9',
                          color: '#475569',
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: asm.has_data ? '#1e293b' : '#64748b',
                      marginBottom: 4,
                    }}
                  >
                    {asm.has_data
                      ? asm.support_status_text
                      : 'Assessment pending'}
                  </div>

                  {/* Identified concepts requiring revision */}
                  {asm.has_data && asm.concepts_requiring_revision && asm.concepts_requiring_revision.length > 0 ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: '#9a3412', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Concepts for revision:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {asm.concepts_requiring_revision.map((c, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: 11,
                              background: '#ffedd5',
                              color: '#c2410c',
                              border: '1px solid #fdba74',
                              borderRadius: 6,
                              padding: '2px 6px',
                              fontWeight: 600,
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : !asm.has_data ? (
                    <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>
                      No assessment data yet for this grade cohort.
                    </div>
                  ) : null}
                </div>

                {/* 3. Assessment or Progress Indicator */}
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#64748b',
                      marginBottom: 4,
                    }}
                  >
                    <span>Cohort Mastery Indicator</span>
                    <b>{asm.average_progress !== null ? `${asm.average_progress}%` : 'Pending'}</b>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <i
                      style={{
                        width: asm.average_progress !== null ? `${asm.average_progress}%` : '0%',
                        background: '#155c53',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Functional "View Classroom" Button */}
              <button
                className="btn small full"
                style={{
                  background: '#176b63',
                  color: '#ffffff',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  minHeight: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setPath(`/teacher?grade=${grade.grade_id}`)}
                data-testid={`btn-view-classroom-${grade.grade_id}`}
                title={`Open Grade ${grade.grade_id} Classroom Overview`}
              >
                <span>View Classroom</span>
                <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

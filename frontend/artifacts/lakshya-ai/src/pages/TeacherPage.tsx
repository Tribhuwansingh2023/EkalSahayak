import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Share2,
  Calendar,
  Clock,
  AlertTriangle,
  Printer,
  Sparkles,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { AppData } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';
import { ensureAuthenticatedSession } from '@/lib/auth-service';

interface TeacherPageProps {
  data: AppData;
  setNotice: (s: string) => void;
}

interface Classroom {
  _id: string;
  name: string;
  grades: string[];
  invite_code: string;
  student_count: number;
}

interface StudentItem {
  id: string;
  name: string;
  grade: string;
  average_mastery: number;
  time_on_task_minutes: number;
  streak: number;
  misconceptions_count: number;
}

interface DashboardData {
  has_classroom: boolean;
  classroom_id?: string;
  name?: string;
  invite_code?: string;
  grades?: string[];
  student_count: number;
  students: StudentItem[];
  average_mastery: number;
  total_time_on_task_minutes: number;
  stuck_concepts: Array<{ concept_id: string; struggling_students_count: number }>;
  misconception_clusters: Array<{ misconception: string; affected_students_count: number }>;
  empty_state: boolean;
  message?: string;
}

interface PeriodPlan {
  classroom_name: string;
  period_duration_minutes: number;
  subject: string;
  generated_at: string;
  group_a: {
    grade_group: string;
    activity_type: string;
    concept: string;
    citation: string;
    time_allocation_minutes: number;
    instructions: string[];
    expected_output: string;
  };
  group_b: {
    grade_group: string;
    activity_type: string;
    concept: string;
    citation: string;
    time_allocation_minutes: number;
    instructions: string[];
    expected_output: string;
  };
  teacher_orchestration: {
    phase_name: string;
    time_allocation_minutes: number;
    focus_misconception: string;
    citation: string;
    teacher_script: string[];
  };
  printable_html_url: string;
}

export function TeacherPage({ data, setNotice }: TeacherPageProps) {
  const { t, i18n } = useTranslation();
  const numerals = getStoredNumerals();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Class Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('Class 9/8 Multigrade Science');
  const [creatingClass, setCreatingClass] = useState(false);

  // Plan My Period State
  const [periodPlan, setPeriodPlan] = useState<PeriodPlan | null>(null);
  const [planningPeriod, setPlanningPeriod] = useState(false);

  const fetchClassrooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/teacher/classrooms', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const list = await res.json();
        setClassrooms(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0]._id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching classrooms.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async (classId: string) => {
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch(`/api/teacher/dashboard/${classId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setDashboard(d);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching classroom dashboard.');
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchDashboard(selectedClassId);
    }
  }, [selectedClassId]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingClass(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/teacher/classroom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newClassName,
          grades: ['Class 9', 'Class 8'],
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCreateModalOpen(false);
        setNotice(`Classroom '${created.name}' created with invite code ${created.invite_code}`);
        fetchClassrooms();
        setSelectedClassId(created._id);
      }
    } catch {
      setError('Could not create classroom.');
    } finally {
      setCreatingClass(false);
    }
  };

  const handlePlanPeriod = async () => {
    if (!selectedClassId) return;
    setPlanningPeriod(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/teacher/plan-period', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classroom_id: selectedClassId,
          duration_minutes: 40,
          subject: 'Science',
        }),
      });
      if (res.ok) {
        const plan = await res.json();
        setPeriodPlan(plan);
      }
    } catch {
      setError('Could not generate multi-grade period plan.');
    } finally {
      setPlanningPeriod(false);
    }
  };

  return (
    <div className="stack" data-testid="teacher-page">
      {/* Top Controls Header */}
      <div className="card">
        <div className="card-heading" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Multi-Grade Classroom Orchestrator</h2>
            <div className="smalltext muted">
              Manage composite classrooms across Class 9 and Class 8 with simultaneous grounded orchestration.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn gold"
              onClick={() => setCreateModalOpen(true)}
              data-testid="button-create-classroom"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Create Classroom
            </button>
            {selectedClassId && (
              <button
                className="btn teal"
                onClick={handlePlanPeriod}
                disabled={planningPeriod}
                data-testid="button-plan-period"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Sparkles size={16} />
                {planningPeriod ? 'Orchestrating...' : 'Plan My Period'}
              </button>
            )}
          </div>
        </div>

        {/* Classroom Tabs */}
        {classrooms.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
            {classrooms.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedClassId(c._id)}
                className={`btn small ${selectedClassId === c._id ? 'gold' : 'soft'}`}
                style={{ borderRadius: 20 }}
              >
                {c.name} ({c.student_count || 0})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Classroom Details & Real Dashboard */}
      {dashboard && (
        <div className="stack">
          {/* Invite Code Bar */}
          <div
            style={{
              background: '#f0fdfa',
              border: '1.5px solid #99f6e4',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' }}>
                Enrollment Invite Code
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#134e4a', letterSpacing: '0.05em' }}>
                {dashboard.invite_code || 'EKAL-CLASS'}
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#0d9488' }}>
              Give this code to students to join this class session.
            </div>
          </div>

          {/* Real Metrics Row */}
          <div className="metric-row">
            <div className="metric">
              <b>{dashboard.student_count}</b>
              <span>Enrolled Students</span>
            </div>
            <div className="metric">
              <b>{formatPercent(dashboard.average_mastery, i18n.language, numerals)}</b>
              <span>Class Average Mastery</span>
            </div>
            <div className="metric">
              <b>{dashboard.total_time_on_task_minutes}m</b>
              <span>Total Time on Task</span>
            </div>
          </div>

          {/* Empty State: Zero Students Enrolled */}
          {dashboard.empty_state && (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                border: '1.5px dashed #cbd5e1',
                borderRadius: 18,
              }}
              data-testid="teacher-empty-state"
            >
              <div style={{ display: 'inline-flex', padding: 14, background: '#f1f5f9', borderRadius: '50%', marginBottom: 12 }}>
                <Users size={32} color="#64748b" />
              </div>
              <h3 style={{ fontSize: 17, color: '#1e293b', margin: '0 0 6px', fontWeight: 700 }}>
                No Students Enrolled Yet
              </h3>
              <p style={{ color: '#64748b', fontSize: 14, maxWidth: 440, margin: '0 auto 16px' }}>
                {dashboard.message}
              </p>
              <span className="tag teal">Invite Code: {dashboard.invite_code}</span>
            </div>
          )}

          {/* Real Enrolled Students Table */}
          {!dashboard.empty_state && dashboard.students.length > 0 && (
            <div className="card">
              <div className="card-heading">
                <h2>Enrolled Student Roster</h2>
                <span className="tag teal">{dashboard.students.length} Active</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#6d7066', fontSize: 12 }}>
                      <th style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>Student</th>
                      <th style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>Grade</th>
                      <th style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>Mastery</th>
                      <th style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>Time on Task</th>
                      <th style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>Streak</th>
                      <th style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>Misconceptions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.students.map((s) => (
                      <tr key={s.id} data-testid={`row-student-${s.id}`}>
                        <td style={{ padding: 12, borderBottom: '1px solid #ece5d8' }}>
                          <b>{s.name}</b>
                        </td>
                        <td>{s.grade}</td>
                        <td>{formatPercent(s.average_mastery, i18n.language, numerals)}</td>
                        <td>{s.time_on_task_minutes} min</td>
                        <td>{s.streak} days</td>
                        <td>
                          {s.misconceptions_count > 0 ? (
                            <span className="tag red">{s.misconceptions_count} Needs Review</span>
                          ) : (
                            <span className="tag teal">On Track</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Real Misconception Clusters */}
          {dashboard.misconception_clusters.length > 0 && (
            <div className="card">
              <div className="card-heading">
                <h2>Detected Misconception Clusters</h2>
                <span className="tag red">Real Assessment Telemetry</span>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {dashboard.misconception_clusters.map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontSize: 13, fontWeight: 600 }}>
                      <AlertTriangle size={16} color="#d97706" />
                      <span>{c.misconception}</span>
                    </div>
                    <span className="tag red">{c.affected_students_count} Students Affected</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan My Period Modal / View */}
          {periodPlan && (
            <div
              className="card"
              style={{
                border: '2px solid #0f766e',
                borderRadius: 20,
                background: '#f0fdfa',
              }}
              data-testid="period-plan-card"
            >
              <div className="card-heading" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ color: '#0f766e', margin: '0 0 4px' }}>
                    Orchestrated 40-Minute Multigrade Period Plan
                  </h2>
                  <div style={{ fontSize: 12, color: '#0d9488' }}>
                    Grounded in NCERT Class 9 & Class 8 textbooks. Ready for simultaneous classroom execution.
                  </div>
                </div>
                <button
                  className="btn small gold"
                  onClick={() => window.open(periodPlan.printable_html_url, '_blank')}
                  data-testid="button-print-plan"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={15} /> Printable 1-Page PDF/HTML
                </button>
              </div>

              <div className="grid-main" style={{ marginTop: 14 }}>
                {/* Group A (Class 9 Independent) */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f766e' }}>
                      {periodPlan.group_a.grade_group}
                    </span>
                    <span className="tag teal">{periodPlan.group_a.time_allocation_minutes} Min</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>
                    Activity: {periodPlan.group_a.activity_type} — <i>{periodPlan.group_a.concept}</i>
                  </p>
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 12 }}>
                    Citation: {periodPlan.group_a.citation}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    {periodPlan.group_a.instructions.map((inst, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {inst}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    Target: {periodPlan.group_a.expected_output}
                  </div>
                </div>

                {/* Group B (Class 8 Paper / Peer) */}
                <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#b45309' }}>
                      {periodPlan.group_b.grade_group}
                    </span>
                    <span className="tag gold">{periodPlan.group_b.time_allocation_minutes} Min</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>
                    Activity: {periodPlan.group_b.activity_type} — <i>{periodPlan.group_b.concept}</i>
                  </p>
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 12 }}>
                    Citation: {periodPlan.group_b.citation}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    {periodPlan.group_b.instructions.map((inst, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {inst}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    Target: {periodPlan.group_b.expected_output}
                  </div>
                </div>
              </div>

              {/* Teacher Orchestration Phase */}
              <div
                style={{
                  marginTop: 16,
                  background: '#ffffff',
                  border: '1.5px solid #0f766e',
                  borderRadius: 14,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#115e59' }}>
                    Teacher Live Phase: {periodPlan.teacher_orchestration.phase_name}
                  </span>
                  <span className="tag teal">{periodPlan.teacher_orchestration.time_allocation_minutes} Min</span>
                </div>
                <div style={{ fontSize: 12, color: '#047857', fontWeight: 600, marginBottom: 8 }}>
                  Focus: {periodPlan.teacher_orchestration.focus_misconception} ({periodPlan.teacher_orchestration.citation})
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
                  {periodPlan.teacher_orchestration.teacher_script.map((step, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Classroom Modal */}
      {createModalOpen && (
        <div className="modal-scrim" data-testid="create-classroom-modal">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: 20, color: '#0f766e', margin: '0 0 8px' }}>Create Composite Classroom</h2>
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
              Set up a multi-grade classroom session to orchestrate simultaneous learning.
            </p>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Classroom Name
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="field"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn soft small"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn gold small"
                  disabled={creatingClass}
                >
                  {creatingClass ? 'Creating...' : 'Create & Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

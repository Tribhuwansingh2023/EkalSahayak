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
  CheckCircle2,
  Edit3,
  GraduationCap,
  RotateCcw,
} from 'lucide-react';
import { AppData } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';
import { ensureAuthenticatedSession } from '@/lib/auth-service';

interface TeacherPageProps {
  data: AppData;
  setNotice: (s: string) => void;
  initialGrade?: string | number;
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

export function TeacherPage({ data, setNotice, initialGrade }: TeacherPageProps) {
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

  // Grade-Specific Classroom View State
  const [activeGradeView, setActiveGradeView] = useState<number | null>(() => {
    if (initialGrade) return parseInt(String(initialGrade), 10);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const g = params.get('grade');
      if (g) return parseInt(g, 10);
    }
    return null;
  });
  const [gradeDetail, setGradeDetail] = useState<any | null>(null);
  const [loadingGradeDetail, setLoadingGradeDetail] = useState(false);
  const [editingActivity, setEditingActivity] = useState(false);
  const [actNameInput, setActNameInput] = useState('');
  const [actStatusInput, setActStatusInput] = useState('In Progress');
  const [updatingActivity, setUpdatingActivity] = useState(false);

  const fetchGradeDetail = async (gradeNum: number) => {
    setLoadingGradeDetail(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch(`/api/teacher/command-center/grade/${gradeNum}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setGradeDetail(d);
        if (d.current_activity) {
          setActNameInput(d.current_activity.name || '');
          setActStatusInput(d.current_activity.status || 'In Progress');
        }
      }
    } catch {
      console.warn('Could not fetch grade classroom details');
    } finally {
      setLoadingGradeDetail(false);
    }
  };

  useEffect(() => {
    if (activeGradeView) {
      fetchGradeDetail(activeGradeView);
    }
  }, [activeGradeView]);

  const handleUpdateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGradeView) return;
    setUpdatingActivity(true);
    try {
      const token = await ensureAuthenticatedSession();
      const res = await fetch('/api/teacher/command-center/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          grade: activeGradeView,
          activity_name: actNameInput,
          status: actStatusInput,
        }),
      });
      if (res.ok) {
        setNotice(`Grade ${activeGradeView} activity updated to "${actNameInput}" (${actStatusInput})`);
        setEditingActivity(false);
        fetchGradeDetail(activeGradeView);
      }
    } catch {
      setError('Could not update activity.');
    } finally {
      setUpdatingActivity(false);
    }
  };

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
                onClick={() => { setSelectedClassId(c._id); setActiveGradeView(null); }}
                className={`btn small ${selectedClassId === c._id && activeGradeView === null ? 'gold' : 'soft'}`}
                style={{ borderRadius: 20 }}
              >
                {c.name} ({c.student_count || 0})
              </button>
            ))}
          </div>
        )}

        {/* Multi-Grade View Tabs (Grades 3, 4, 5) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap', borderTop: '1px solid #e2d7c5', paddingTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6d675b' }}>Classroom View:</span>
          <button
            onClick={() => { setActiveGradeView(null); window.history.replaceState({}, '', '/teacher'); }}
            className={`btn small ${activeGradeView === null ? 'gold' : 'soft'}`}
            style={{ borderRadius: 16, padding: '4px 12px', minHeight: 30, fontSize: 12 }}
            data-testid="tab-all-classes"
          >
            Composite (Class 9/8)
          </button>
          {[3, 4, 5].map((g) => (
            <button
              key={g}
              onClick={() => { setActiveGradeView(g); window.history.replaceState({}, '', `/teacher?grade=${g}`); }}
              className={`btn small ${activeGradeView === g ? 'gold' : 'soft'}`}
              style={{ borderRadius: 16, padding: '4px 12px', minHeight: 30, fontSize: 12 }}
              data-testid={`tab-grade-${g}`}
            >
              Grade {g}
            </button>
          ))}
        </div>
      </div>

      {/* Grade-Specific Classroom View (Grades 3, 4, 5) */}
      {activeGradeView !== null && (
        <div className="stack" data-testid={`grade-classroom-view-${activeGradeView}`}>
          {/* Grade Top Banner */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: '#155c53',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {activeGradeView}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
                    {gradeDetail?.classroom_name || `Multi-Grade Section · Grade ${activeGradeView}`}
                  </h2>
                  {gradeDetail?.is_demo && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      Demo data
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  Dedicated classroom monitoring and support view for Grade {activeGradeView} students.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn small soft"
                onClick={() => { setActiveGradeView(null); window.history.replaceState({}, '', '/teacher'); }}
                style={{ borderRadius: 12 }}
              >
                ← Back to Composite
              </button>
              <button
                className="btn small teal"
                onClick={() => fetchGradeDetail(activeGradeView)}
                disabled={loadingGradeDetail}
                style={{ borderRadius: 12 }}
              >
                <RotateCcw size={14} className={loadingGradeDetail ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Cards Grid: Activity & Assessment Summary */}
          {gradeDetail && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 16,
              }}
            >
              {/* Activity Card */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                    Current Learning Activity
                  </span>
                  <button
                    className="btn small soft"
                    style={{ padding: '3px 8px', fontSize: 11, minHeight: 26 }}
                    onClick={() => setEditingActivity(!editingActivity)}
                  >
                    <Edit3 size={12} />
                    <span>{editingActivity ? 'Cancel' : 'Update Activity'}</span>
                  </button>
                </div>

                {!editingActivity ? (
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1e293b' }}>
                      {gradeDetail.current_activity?.name || 'No active activity assigned'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span
                        className={`tag ${
                          gradeDetail.current_activity?.status === 'Completed'
                            ? 'teal'
                            : gradeDetail.current_activity?.status === 'In Progress'
                            ? 'gold'
                            : ''
                        }`}
                        style={{ fontWeight: 700 }}
                      >
                        {gradeDetail.current_activity?.status || 'Not Started'}
                      </span>
                      {gradeDetail.current_activity?.progress_percent !== null && (
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {gradeDetail.current_activity.progress_percent}% Complete
                        </span>
                      )}
                    </div>
                    {gradeDetail.current_activity?.progress_percent !== null && (
                      <div className="progress-track" style={{ height: 6 }}>
                        <i
                          style={{
                            width: `${gradeDetail.current_activity.progress_percent}%`,
                            background:
                              gradeDetail.current_activity.status === 'Completed' ? '#155c53' : '#e4aa37',
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleUpdateActivity} style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Activity Name
                      </label>
                      <input
                        type="text"
                        value={actNameInput}
                        onChange={(e) => setActNameInput(e.target.value)}
                        className="field"
                        style={{ padding: '8px 10px', fontSize: 13 }}
                        required
                      />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Status
                      </label>
                      <select
                        value={actStatusInput}
                        onChange={(e) => setActStatusInput(e.target.value)}
                        className="field"
                        style={{ padding: '8px 10px', fontSize: 13 }}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn small soft"
                        onClick={() => setEditingActivity(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn small gold"
                        disabled={updatingActivity}
                      >
                        {updatingActivity ? 'Saving...' : 'Save Activity'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Assessment & Support Needs Card */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                    Assessment & Support Needs
                  </span>
                  <span
                    className={`tag ${gradeDetail.assessment?.has_data ? (gradeDetail.assessment?.students_needing_support ? 'red' : 'teal') : ''}`}
                    style={{ fontWeight: 700 }}
                  >
                    {gradeDetail.assessment?.has_data ? (gradeDetail.assessment?.students_needing_support ? `${gradeDetail.assessment.students_needing_support} Needing Support` : 'All On Track') : 'Assessment Pending'}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#1e293b' }}>
                  {gradeDetail.assessment?.has_data ? gradeDetail.assessment.support_status_text : 'Assessment pending'}
                </h3>

                {gradeDetail.assessment?.has_data ? (
                  <div>
                    {gradeDetail.assessment.concepts_requiring_revision?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#c2410c', display: 'block', marginBottom: 4 }}>
                          Concepts Requiring Revision:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {gradeDetail.assessment.concepts_requiring_revision.map((c: string, i: number) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 11,
                                background: '#ffedd5',
                                color: '#c2410c',
                                border: '1px solid #fdba74',
                                borderRadius: 6,
                                padding: '3px 8px',
                                fontWeight: 600,
                              }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {gradeDetail.assessment.average_progress !== null && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                          <span>Cohort Mastery</span>
                          <b>{gradeDetail.assessment.average_progress}%</b>
                        </div>
                        <div className="progress-track" style={{ height: 6 }}>
                          <i style={{ width: `${gradeDetail.assessment.average_progress}%`, background: '#155c53' }} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
                    Students in Grade {activeGradeView} have not completed their baseline diagnostic yet. Support needs will be computed automatically once tests are taken.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Student Roster Table */}
          {gradeDetail?.students && (
            <div
              className="card"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
                  Enrolled Students ({gradeDetail.students.length})
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Grade {activeGradeView} Cohort Roster
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '8px 10px' }}>Student Name</th>
                      <th style={{ padding: '8px 10px' }}>Mastery</th>
                      <th style={{ padding: '8px 10px' }}>Support Status</th>
                      <th style={{ padding: '8px 10px' }}>Target / Stuck Concept</th>
                      <th style={{ padding: '8px 10px' }}>Activity Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeDetail.students.map((st: any) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600, color: '#1e293b' }}>
                          {st.name}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          {st.mastery !== null ? `${Math.round(st.mastery * 100)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span
                            className={`tag ${
                              st.status === 'Needs Support'
                                ? 'red'
                                : st.status === 'On Track'
                                ? 'teal'
                                : st.status === 'Advanced'
                                ? 'gold'
                                : ''
                            }`}
                            style={{ fontWeight: 700 }}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', color: st.stuck_concept ? '#c2410c' : '#64748b' }}>
                          {st.stuck_concept || '—'}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#64748b', fontSize: 12 }}>
                          {st.last_active}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classroom Details & Real Dashboard (Composite View) */}
      {activeGradeView === null && dashboard && (
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

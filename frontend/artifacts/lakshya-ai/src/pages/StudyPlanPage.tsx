import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Target } from 'lucide-react';
import { AppData, Student } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';

interface StudyPlanPageProps {
  learner: Student;
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setPath: (s: string) => void;
}

const planSeed = [
  { id: 'learn', time: '0–20 min', title: 'Learn New Concept', kind: 'Learn', why: 'Understand motion and speed through everyday examples.', mins: 20 },
  { id: 'probe', time: '20–30 min', title: 'Quick Comprehension Check', kind: 'Check', why: 'Let’s check how well you understood the concept.', mins: 10 },
  { id: 'review', time: '30–45 min', title: 'Review Mass vs Weight', kind: 'Review', why: 'Clarify common misconceptions between these two concepts.', mins: 15 },
  { id: 'practice', time: '45–60 min', title: 'Practice Questions', kind: 'Practice', why: 'Reinforce today’s learning with quiz questions.', mins: 15 }
];

const conceptSeeds = [
  { id: 'motion', name: 'Motion', pre: 'Prerequisite: Distance' },
  { id: 'force', name: 'Force & Laws', pre: 'Prerequisite: Motion' },
  { id: 'mass', name: 'Mass vs Weight', pre: 'Prerequisite: Force' },
  { id: 'speed', name: 'Speed', pre: 'Prerequisite: Distance & Time' }
];

export function StudyPlanPage({ learner, data, patch, setPath }: StudyPlanPageProps) {
  const { t, i18n } = useTranslation();
  const numerals = getStoredNumerals();

  return (
    <div className="grid-main" data-testid="study-plan-page">
      <section className="stack">
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>{t('studyplan.title')}</h2>
              <div className="smalltext muted">{t('studyplan.subtitle')}</div>
            </div>
            <span className="tag teal">{t('studyplan.todayFocus')}</span>
          </div>
          {planSeed.map((item) => {
            const done = data.planDone.includes(item.id);
            return (
              <div className="plan-line" key={item.id}>
                <div className="plan-time">{item.time}</div>
                <div>
                  <div className="row">
                    <span className="tag">{item.kind}</span>
                    <b>{item.title}</b>
                  </div>
                  <div className="smalltext muted" style={{ marginTop: 5 }}>{item.why}</div>
                </div>
                <button
                  className={`btn small ${done ? 'soft' : 'outline'}`}
                  onClick={() => {
                    patch({ planDone: done ? data.planDone.filter(x => x !== item.id) : [...data.planDone, item.id] });
                    if (item.id === 'practice') setPath('/practice');
                  }}
                  data-testid={`button-plan-${item.id}`}
                >
                  {done ? <><Check size={15} /> {t('learn.completed')}</> : t('learn.startLesson')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>{t('nav.conceptMap')}</h2>
            <span className="tag teal">{t('studyplan.targetMastery')}</span>
          </div>
          {conceptSeeds.map(c => {
            const rawMastery = learner.masteryMap[c.id] ?? 0;
            // Decimal 0..1 ratio formatting
            const ratio = rawMastery > 1 ? rawMastery / 100 : rawMastery;
            const formattedMastery = formatPercent(ratio, i18n.language, numerals);
            const percentWidth = Math.round(ratio * 100);

            return (
              <div className="mastery-node" style={{ marginBottom: 10 }} key={c.id}>
                <div className="row between">
                  <b>{c.name}</b>
                  <span className="tag">{formattedMastery}</span>
                </div>
                <div className="smalltext muted">{c.pre}</div>
                <div className="progress-track" style={{ marginTop: 9 }}>
                  <i style={{ width: `${percentWidth}%` }} />
                </div>
                {c.id === 'mass' && (
                  <div className="smalltext" style={{ marginTop: 8, color: '#a05f2e' }}>
                    {t('studyplan.reviewMistakes')}: Mass vs Weight
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>{t('learn.dailyGoal')}</h2>
            <Target size={20} />
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{data.planDone.length}/4</b>
              <span>{t('studyplan.dailyProgress')}</span>
            </div>
            <div className="metric">
              <b>{formatNumber(learner.streak, i18n.language, numerals)}</b>
              <span>{t('learn.streak')}</span>
            </div>
            <div className="metric">
              <b>{formatNumber(15, i18n.language, numerals)}</b>
              <span>{t('studyplan.timeSpent')}</span>
            </div>
          </div>
          <button className="btn full" style={{ marginTop: 16 }} onClick={() => setPath('/practice')} data-testid="button-plan-practice">
            {t('studyplan.practiceQuiz')} <ChevronRight size={17} />
          </button>
        </div>
      </aside>
    </div>
  );
}

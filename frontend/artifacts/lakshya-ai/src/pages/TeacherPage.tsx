import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Languages, Sparkles } from 'lucide-react';
import { AppData } from '@/types/app';
import { formatPercent, formatNumber } from '@/lib/formatters';
import { getStoredNumerals } from '@/i18n';

interface TeacherPageProps {
  data: AppData;
  setNotice: (s: string) => void;
}

export function TeacherPage({ data, setNotice }: TeacherPageProps) {
  const { t, i18n } = useTranslation();
  const numerals = getStoredNumerals();
  const [summary, setSummary] = useState('');
  const [sms, setSms] = useState(false);

  return (
    <div className="stack" data-testid="teacher-page">
      <div className="card">
        <div className="card-heading">
          <div>
            <h2>{t('teacher.roster')}</h2>
            <div className="smalltext muted">{t('teacher.subtitle')}</div>
          </div>
          <span className="tag teal">{t('teacher.title')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6d7066', fontSize: 12 }}>
                {[
                  t('common.appName') + ' Learner',
                  t('common.grade'),
                  t('learn.chapters'),
                  t('learn.streak'),
                  t('teacher.masteryOverview'),
                  t('teacher.strugglingStudents'),
                ].map((h) => (
                  <th key={h} style={{ padding: '12px 8px', borderBottom: '1px solid #ddd3c1' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.learners.map((l) => {
                const vals = Object.values(l.masteryMap);
                const avg = Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
                const sName = l.name || l.nameLatin || 'Student';
                return (
                  <tr key={l.id} data-testid={`row-roster-${l.id}`}>
                    <td style={{ padding: 13, borderBottom: '1px solid #ece5d8' }}>
                      <b>{sName}</b>
                    </td>
                    <td>{t('common.class9')}</td>
                    <td>{l.lastChapter}</td>
                    <td>{formatNumber(l.streak, i18n.language, numerals)} days</td>
                    <td>
                      <div className="row items-center gap-2">
                        <div className="progress-track" style={{ width: 80 }}>
                          <i style={{ width: `${avg}%` }} />
                        </div>
                        {formatPercent(avg / 100, i18n.language, numerals)}
                      </div>
                    </td>
                    <td>
                      {l.masteryMap.mass && l.masteryMap.mass < 50 ? (
                        <span className="tag red">Mass vs Weight</span>
                      ) : (
                        <span className="tag teal">On Track</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-heading">
            <h2>{t('teacher.strugglingStudents')}</h2>
            <Lightbulb size={20} />
          </div>
          <div className="mastery-node">
            <div className="row between">
              <b>Confusing Mass and Weight</b>
              <span className="tag red">Sample Alert</span>
            </div>
            <p className="smalltext muted">
              Mass remains constant anywhere; weight varies with gravity. Clarify with everyday weighing examples.
            </p>
          </div>
          <div className="mastery-node" style={{ marginTop: 12 }}>
            <div className="row between">
              <b>Speed vs Distance Confusion</b>
              <span className="tag">Needs Support</span>
            </div>
            <p className="smalltext muted">
              Examples of covering the same distance in different time durations help reinforce the concept.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>{t('teacher.interventions')}</h2>
            <Languages size={19} />
          </div>
          <p>
            Today we explored motion. When an object changes position over time, it is in motion. Speed equals distance divided by time. Remember that mass and weight are fundamentally different properties.
          </p>
          <div className="smalltext muted">Curriculum aligned summaries prepared for educators and community facilitators.</div>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 14 }}>
            <button
              className="btn"
              onClick={() => {
                setSummary('Today’s Science Summary: Motion is change of position over time. Speed = Distance ÷ Time. Mass and weight are distinct properties.');
                setNotice('Summary generated.');
              }}
              data-testid="button-generate-summary"
            >
              <Sparkles size={16} /> Generate Summary
            </button>
            <button className="btn soft" onClick={() => setSms(!sms)} data-testid="button-sms-preview">
              SMS Preview
            </button>
          </div>
          {summary && <div className="answer-panel" data-testid="text-generated-summary">{summary}</div>}
          {sms && (
            <div className="answer-panel" data-testid="text-sms-preview">
              Greetings! Today’s Science topic: Motion & Speed. Discuss the difference between mass and weight at home. — Demo SMS preview; not sent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

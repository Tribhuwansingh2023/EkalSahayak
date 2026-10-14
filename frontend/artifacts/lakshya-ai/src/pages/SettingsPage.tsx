import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import {
  UserRound,
  BookOpen,
  Wifi,
  Cloud,
  Languages,
  Check,
  Search,
  AlertCircle,
  X,
  Download,
  Sparkles,
  MessageSquareQuote,
  Send,
} from 'lucide-react';
import { AppData } from '@/types/app';
import {
  LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  RECOMMENDED_LANGUAGE_CODES,
  SupportedLanguageCode,
  getLanguage,
} from '@/i18n/languages';
import {
  setAppLanguage,
  getStoredNumerals,
  setStoredNumerals,
  getStoredAiSameLanguage,
  setStoredAiSameLanguage,
  getStoredKeepEnglishTerms,
  setStoredKeepEnglishTerms,
} from '@/i18n';
import { getStoredUser } from '@/lib/auth-service';

interface SettingsPageProps {
  data: AppData;
  patch: (p: Partial<AppData>) => void;
  setNotice: (s: string) => void;
}

export function SettingsPage({ data, patch, setNotice }: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'en') as SupportedLanguageCode;
  const currentMeta = getLanguage(currentLang);

  // Search state for languages
  const [searchQuery, setSearchQuery] = useState('');
  const [numeralsMode, setNumeralsMode] = useState<'latin' | 'local'>(getStoredNumerals());
  const [aiSameLang, setAiSameLang] = useState<boolean>(getStoredAiSameLanguage());
  const [keepTerms, setKeepTerms] = useState<boolean>(getStoredKeepEnglishTerms());

  // Bad translation report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportKey, setReportKey] = useState('common.welcome');
  const [reportSuggestion, setReportSuggestion] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const activeStudent = data.learners.find((l) => l.id === data.activeId);
  const authUser = getStoredUser();
  const studentName = authUser?.name || activeStudent?.name || activeStudent?.nameLatin || 'Student';

  // Group and filter languages
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return SUPPORTED_LANGUAGE_CODES.map((code) => LANGUAGES[code]).filter((lang) => {
      if (!q) return true;
      return (
        lang.englishName.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  const recommendedLangs = useMemo(() => {
    return filteredLanguages.filter((l) => (RECOMMENDED_LANGUAGE_CODES as readonly string[]).includes(l.code));
  }, [filteredLanguages]);

  const otherLangs = useMemo(() => {
    return filteredLanguages.filter((l) => !(RECOMMENDED_LANGUAGE_CODES as readonly string[]).includes(l.code));
  }, [filteredLanguages]);

  const handleSelectLanguage = async (code: SupportedLanguageCode) => {
    const nextMeta = getLanguage(code);
    await setAppLanguage(code, true);
    // Instant toast in the new language
    const toastMsg = i18n.t('common.languageChanged', {
      defaultValue: `${nextMeta.nativeName} (${nextMeta.englishName})`,
    });
    setNotice(toastMsg);
  };

  const handleToggleNumerals = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked ? 'local' : 'latin';
    setNumeralsMode(next);
    setStoredNumerals(next);
    setNotice(next === 'local' ? t('settings.localNumerals') : t('settings.latinNumerals'));
  };

  const handleToggleAiLanguage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAiSameLang(val);
    setStoredAiSameLanguage(val);
  };

  const handleToggleKeepTerms = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setKeepTerms(val);
    setStoredKeepEnglishTerms(val);
  };

  const togglePack = (id: string) => {
    patch({
      packs: data.packs.map((p) => (p.id === id ? { ...p, downloaded: !p.downloaded } : p)),
    });
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportSuggestion.trim()) return;

    setReportSending(true);
    try {
      const token = localStorage.getItem('ekalsahayak_token') || sessionStorage.getItem('token');
      await fetch('/api/feedback/translation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          key: reportKey || 'general',
          lang: currentLang,
          suggestion: reportSuggestion.trim(),
        }),
      });
      setReportSent(true);
      setNotice(t('settings.feedbackSuccess'));
      setTimeout(() => {
        setReportModalOpen(false);
        setReportSent(false);
        setReportSuggestion('');
      }, 1500);
    } catch (err) {
      console.error('Feedback submission failed:', err);
      setNotice(t('common.error'));
    } finally {
      setReportSending(false);
    }
  };

  return (
    <div className="grid-main" data-testid="settings-page">
      <section className="stack">
        {/* App Language Selection Card */}
        <div className="card" data-testid="card-app-language">
          <div className="card-heading">
            <div className="row items-center gap-2">
              <Languages size={22} className="text-teal-600" />
              <h2>{t('settings.appLanguage')}</h2>
            </div>
            <span className="tag teal">{currentMeta.nativeName} · {currentMeta.englishName}</span>
          </div>
          <p className="smalltext muted mb-3">{t('settings.appLanguageDesc')}</p>

          {/* Search Box */}
          <div className="search-bar mb-3" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--color-input, #ede8dc)', borderRadius: 10 }}>
            <Search size={16} className="text-gray-500" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-0 outline-none w-full text-sm"
              data-testid="input-language-search"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-gray-500 hover:text-black">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Languages List Container with Scroll */}
          <div
            className="languages-picker-list stack gap-1"
            style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}
            data-testid="languages-list"
          >
            {/* Recommended Group */}
            {recommendedLangs.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                  {t('common.recommended')}
                </div>
                {recommendedLangs.map((lang) => {
                  const isSelected = currentLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`row between items-center w-full px-3 py-2 rounded-lg text-start transition-colors ${
                        isSelected ? 'bg-teal-100 dark:bg-teal-900 border border-teal-500 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      data-testid={`lang-option-${lang.code}`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{lang.nativeName}</span>
                          <span className="text-xs text-gray-500">· {lang.englishName}</span>
                          {lang.tier === 'B' && <span className="tag gold text-2xs px-1 py-0.5">{t('common.beta')}</span>}
                        </div>
                        <span className="text-xs text-gray-400 font-mono mt-0.5">{lang.sampleText}</span>
                      </div>
                      {isSelected && <Check size={18} className="text-teal-600 shrink-0 ms-2" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* All Languages Group */}
            {otherLangs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                  {t('common.allLanguages')} ({otherLangs.length})
                </div>
                {otherLangs.map((lang) => {
                  const isSelected = currentLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleSelectLanguage(lang.code)}
                      className={`row between items-center w-full px-3 py-2 rounded-lg text-start transition-colors ${
                        isSelected ? 'bg-teal-100 dark:bg-teal-900 border border-teal-500 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      data-testid={`lang-option-${lang.code}`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{lang.nativeName}</span>
                          <span className="text-xs text-gray-500">· {lang.englishName}</span>
                          {lang.tier === 'B' && <span className="tag gold text-2xs px-1 py-0.5">{t('common.beta')}</span>}
                        </div>
                        <span className="text-xs text-gray-400 font-mono mt-0.5">{lang.sampleText}</span>
                      </div>
                      {isSelected && <Check size={18} className="text-teal-600 shrink-0 ms-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Preview Sample */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 flex items-center justify-between">
            <span className="italic">
              Preview: "{currentMeta.sampleText}"
            </span>
            <button
              onClick={() => setReportModalOpen(true)}
              className="text-xs text-teal-700 hover:underline flex items-center gap-1"
              data-testid="button-report-bad-translation"
            >
              <MessageSquareQuote size={13} />
              {t('settings.reportBadTranslation')}
            </button>
          </div>
        </div>

        {/* Profile & Device Preferences Card */}
        <div className="card">
          <div className="card-heading">
            <h2>{t('settings.profileAndDevice')}</h2>
            <UserRound size={20} />
          </div>
          <div className="concept-row">
            <span className="profile-illustration" style={{ width: 48, height: 48, borderRadius: 16 }}>
              {(studentName || 'Student').slice(0, 1)}
            </span>
            <div style={{ flex: 1 }}>
              <b>{studentName} · {t('common.class9')}</b>
              <div className="smalltext muted">
                {authUser ? authUser.email : t('settings.localOnlyStatus')}
              </div>
            </div>
            <Link href="/" className="btn outline small" data-testid="link-change-profile">
              Switch
            </Link>
          </div>

          {/* Numerals Toggle */}
          <div className="toggle-row">
            <span>
              <b>{t('settings.numerals')}</b>
              <div className="smalltext muted">{t('settings.numeralsDesc')}</div>
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-mono">{numeralsMode === 'local' ? t('settings.localNumerals') : t('settings.latinNumerals')}</span>
              <input
                className="switch"
                type="checkbox"
                checked={numeralsMode === 'local'}
                onChange={handleToggleNumerals}
                data-testid="toggle-numerals"
              />
            </label>
          </div>

          {/* AI answers in same language toggle */}
          <div className="toggle-row">
            <span>
              <b>{t('settings.aiSameLanguage')}</b>
              <div className="smalltext muted">{t('settings.aiSameLanguageDesc')}</div>
            </span>
            <input
              className="switch"
              type="checkbox"
              checked={aiSameLang}
              onChange={handleToggleAiLanguage}
              data-testid="toggle-ai-same-language"
            />
          </div>

          {/* Keep English science terms in brackets toggle */}
          <div className="toggle-row">
            <span>
              <b>{t('settings.keepEnglishTerms')}</b>
              <div className="smalltext muted">{t('settings.keepEnglishTermsDesc')}</div>
            </span>
            <input
              className="switch"
              type="checkbox"
              checked={keepTerms}
              onChange={handleToggleKeepTerms}
              data-testid="toggle-keep-terms"
            />
          </div>

          <div className="smalltext muted" style={{ paddingTop: 13 }}>
            {t('settings.serverSyncStatus')}: {authUser ? authUser.username : 'Guest Session'}
          </div>
        </div>

        {/* Offline Chapter Packs */}
        <div className="card">
          <div className="card-heading">
            <h2>{t('practice.offlineChapterPacks')}</h2>
            <span className="tag teal">{data.packs.filter((p) => p.downloaded).length} {t('practice.downloaded')}</span>
          </div>
          <p className="smalltext muted">{t('settings.offlineStorageDesc')}</p>
          {data.packs.map((p) => (
            <div className="concept-row" key={p.id}>
              <span className="concept-mark"><BookOpen size={17} /></span>
              <div style={{ flex: 1 }}>
                <b>{p.title}</b>
                <div className="smalltext muted">{p.chapter} · {p.sizeMb} MB</div>
              </div>
              <button
                className={`btn small ${p.downloaded ? 'outline' : 'soft'}`}
                onClick={() => {
                  togglePack(p.id);
                  setNotice(p.downloaded ? 'Demo pack removed from storage.' : 'Demo pack saved locally.');
                }}
                data-testid={`button-pack-${p.id}`}
              >
                {p.downloaded ? <><X size={15} /> Remove</> : <><Download size={15} /> Download</>}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Aside: Connectivity & Sync State */}
      <aside className="stack">
        <div className="card">
          <div className="card-heading">
            <h2>{t('common.online')} & {t('common.offline')}</h2>
            <Wifi size={20} />
          </div>
          <p className="smalltext muted">Toggle network status to test offline workflows with instant persistence.</p>
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 15 }}>
            {[
              ['online', t('common.online')],
              ['low', 'Low Data'],
              ['offline', t('common.offline')],
            ].map(([v, label]) => (
              <button
                className={`btn small ${data.onlineMode === v ? 'gold' : 'soft'}`}
                key={v}
                onClick={() => patch({ onlineMode: v })}
                data-testid={`button-mode-${v}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="row between">
            <span className="smalltext">Locally Stored Content</span>
            <b>{data.packs.filter((p) => p.downloaded).reduce((a, p) => a + p.sizeMb, 0).toFixed(1)} MB</b>
          </div>
          <div className="data-meter" style={{ marginTop: 9 }}>
            <i style={{ width: `${Math.min(100, data.packs.filter((p) => p.downloaded).reduce((a, p) => a + p.sizeMb, 0) * 2)}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <h2>Offline Outbox</h2>
            <Cloud size={19} />
          </div>
          <div className="metric-row">
            <div className="metric">
              <b>{data.outbox.length}</b>
              <span>Pending</span>
            </div>
            <div className="metric">
              <b>{data.doubts.length}</b>
              <span>Answered</span>
            </div>
            <div className="metric">
              <b>IndexedDB</b>
              <span>Storage</span>
            </div>
          </div>
          <p className="smalltext muted">Curriculum answers are evaluated locally when offline and synced automatically upon reconnection.</p>
          <button
            className="btn outline full"
            onClick={() => {
              patch({ outbox: [] });
              setNotice('Outbox cleared.');
            }}
            data-testid="button-clear-outbox"
          >
            Clear Outbox
          </button>
        </div>
      </aside>

      {/* Translation Feedback Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles size={18} className="text-teal-600" />
                {t('settings.badTranslationModalTitle')}
              </h3>
              <button onClick={() => setReportModalOpen(false)} className="text-gray-400 hover:text-black dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitFeedback} className="stack gap-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">
                  Language: {currentMeta.nativeName} ({currentMeta.code})
                </label>
                <input
                  type="text"
                  value={reportKey}
                  onChange={(e) => setReportKey(e.target.value)}
                  placeholder="Key (e.g. settings.appLanguage)"
                  className="w-full text-xs p-2 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">
                  {t('settings.suggestionLabel')}
                </label>
                <textarea
                  rows={3}
                  value={reportSuggestion}
                  onChange={(e) => setReportSuggestion(e.target.value)}
                  placeholder={t('settings.suggestionPlaceholder')}
                  required
                  className="w-full text-xs p-2 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
                />
              </div>
              {reportSent ? (
                <div className="text-xs text-teal-600 font-medium py-1">
                  {t('settings.feedbackSuccess')}
                </div>
              ) : (
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setReportModalOpen(false)} className="btn small outline">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={reportSending} className="btn small teal flex items-center gap-1">
                    <Send size={13} />
                    {t('settings.submitFeedback')}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

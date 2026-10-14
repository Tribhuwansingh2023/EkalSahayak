import React, { useState, useEffect } from 'react';
import { X, Lock, User, Mail, Sparkles, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, GraduationCap } from 'lucide-react';
import { loginUser, registerUser, AuthUser } from '../lib/auth-service';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [initialMode, isOpen]);
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGrade, setRegGrade] = useState(9);
  const [regMedium, setRegMedium] = useState('Odia');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMsg('ଦୟାକରି ଇମେଲ/ୟୁଜରନେମ୍ ଏବଂ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ (Please enter username/email and password).');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const resp = await loginUser(loginIdentifier.trim(), loginPassword);
      setSuccessMsg(`ସ୍ୱାଗତ, ${resp.user.name}! ସଫଳତାର ସହ ପ୍ରବେଶ କଲେ।`);
      setTimeout(() => {
        onAuthSuccess(resp.user);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword.trim() || !regName.trim() || !regEmail.trim()) {
      setErrorMsg('ଦୟାକରି ସମସ୍ତ ଆବଶ୍ୟକ ତଥ୍ୟ ପୂରଣ କରନ୍ତୁ (Please fill in all fields).');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const resp = await registerUser({
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        name: regName.trim(),
        grade: regGrade,
        medium: regMedium
      });
      setSuccessMsg(`ଅଭିନନ୍ଦନ, ${resp.user.name}! ତୁମର ଖାତା ପ୍ରସ୍ତୁତ ହୋଇଗଲା।`);
      setTimeout(() => {
        onAuthSuccess(resp.user);
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const autofillDemoStudent = (name: string, username: string, grade: number) => {
    if (mode === 'login') {
      setLoginIdentifier(username);
      setLoginPassword('student123');
    } else {
      setRegName(name);
      setRegUsername(username);
      setRegEmail(`${username}@ekal.edu`);
      setRegPassword('student123');
      setRegGrade(grade);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                EkalSahayak <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Auth</span>
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'login' ? 'ପ୍ରବେଶ କରନ୍ତୁ · Student Login' : 'ନୂତନ ଖାତା ଖୋଲନ୍ତୁ · Register New Learner'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            data-testid="button-close-auth-modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5 mx-6 mt-4 rounded-xl">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-login"
          >
            ପ୍ରବେଶ (Login)
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-register"
          >
            ନୂତନ ପଞ୍ଜୀକରଣ (Register)
          </button>
        </div>

        {/* Notification banners */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  ୟୁଜରନେମ୍ କିମ୍ବା ଇମେଲ (Username or Email)
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="lakshya9 or lakshya@ekal.edu"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    required
                    data-testid="input-login-identifier"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  ପାସୱାର୍ଡ (Password)
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    required
                    data-testid="input-login-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                data-testid="button-submit-login"
              >
                {loading ? 'ଯାଞ୍ଚ ହେଉଛି (Authenticating)...' : 'ପ୍ରବେଶ କରନ୍ତୁ (Log In)'}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ପୂରା ନାମ (Full Name in Odia / English)
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="ଲକ୍ଷ୍ୟ ମାଝୀ / Lakshya Majhi"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                    data-testid="input-register-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ୟୁଜରନେମ୍ (Username)
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="lakshya_class9"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                    data-testid="input-register-username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ଶ୍ରେଣୀ (Grade / Class)
                  </label>
                  <select
                    value={regGrade}
                    onChange={(e) => setRegGrade(Number(e.target.value))}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2 px-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                    data-testid="select-register-grade"
                  >
                    <option value={7}>Class 7 (ସପ୍ତମ)</option>
                    <option value={8}>Class 8 (ଅଷ୍ଟମ)</option>
                    <option value={9}>Class 9 (ନବମ - BSE Odisha)</option>
                    <option value={10}>Class 10 (ଦଶମ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ଇମେଲ (Email Address)
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="lakshya@ekal.edu"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                    data-testid="input-register-email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ପାସୱାର୍ଡ (Password - min 6 chars)
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                    data-testid="input-register-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                data-testid="button-submit-register"
              >
                {loading ? 'ପଞ୍ଜୀକରଣ ହେଉଛି...' : 'ନୂତନ ଖାତା ତିଆରି କରନ୍ତୁ (Register & Start)'}
                <Sparkles size={16} />
              </button>
            </form>
          )}

          {/* Quick Demo Fill Helper */}
          <div className="pt-4 border-t border-slate-800">
            <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span>ଦ୍ରୁତ ଡେମୋ ଆକାଉଣ୍ଟ (Quick Demo Auto-Fill):</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => autofillDemoStudent('Lakshya Majhi', 'lakshya_class9', 9)}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-300 text-left transition-colors border border-slate-700/50 flex items-center justify-between"
                data-testid="btn-demo-lakshya"
              >
                <span>🧑 ଲକ୍ଷ୍ୟ (Class 9)</span>
                <span className="text-amber-400 text-[10px]">Fill</span>
              </button>
              <button
                type="button"
                onClick={() => autofillDemoStudent('Rakesh Naik', 'rakesh_class7', 7)}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-300 text-left transition-colors border border-slate-700/50 flex items-center justify-between"
                data-testid="btn-demo-rakesh"
              >
                <span>👦 ରାକେଶ (Class 7)</span>
                <span className="text-amber-400 text-[10px]">Fill</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <GraduationCap size={14} className="text-amber-400" />
          <span>MongoDB Persistent Profiles & BSE Odisha Curriculum</span>
        </div>
      </div>
    </div>
  );
};

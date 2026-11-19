import React, { useEffect, useState } from 'react';
import { getRedirectResult, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { AlertTriangle, ArrowRight, ExternalLink, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { auth, FIREBASE_PROJECT_ID, googleProvider } from '../firebase';
import { BrandMark } from './BrandMark';

interface LoginViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateArchive: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  darkMode,
  onToggleDarkMode,
  onNavigateArchive,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : '';
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        setUnauthorizedHost(window.location.hostname);
      } else if (msg && !msg.includes('popup-closed-by-user')) {
        setErrorMsg(msg);
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setUnauthorizedHost(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : 'Unable to sign in.';
      if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setErrorMsg(
            redirectErr instanceof Error ? redirectErr.message : 'Unable to complete redirect sign-in.'
          );
        }
      } else if (
        code === 'auth/unauthorized-domain' ||
        msg.includes('auth/unauthorized-domain')
      ) {
        setUnauthorizedHost(window.location.hostname);
      } else if (!msg.includes('popup-closed-by-user')) {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#fafafa] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-100">
      {/* Left Brand Visual Panel */}
      <div className="relative lg:flex-[1.15] min-h-[240px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-9 bg-[#3061d0] text-white overflow-hidden">
        <img
          src="/assets/aistudio/maxim-berg-fKPZGJI4dXU-unsplash_b5b78643.jpg"
          alt="IMnexus geometric horizon brand artwork"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/20 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <BrandMark className="text-[16px] text-white" />
        </div>

        <div className="relative z-10 mt-8 lg:mt-0">
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight max-w-xs drop-shadow-sm [text-wrap:balance]">
            Your cases, in continuity.
          </h2>
          <p className="text-xs font-medium text-white/85 mt-2.5">
            Private console · Encrypted vault · Public archive
          </p>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="w-full lg:w-[460px] shrink-0 flex flex-col justify-between p-7 sm:p-12 bg-[#fafafa] dark:bg-[#0f1014] border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle color theme"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        <div className="w-full max-w-[340px] mx-auto my-8">
          <div className="mb-8">
            <BrandMark className="text-[18px] text-zinc-950 dark:text-white" />
          </div>

          <h1 className="text-[26px] font-extrabold tracking-tight leading-tight mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mb-8">
            Sign in with your verified account to manage case dossiers, upload encrypted evidence, and publish public archive sites.
          </p>

          {unauthorizedHost && (
            <div className="mb-5 p-3.5 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-950 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Authorize Deployment Domain</span>
              </div>
              <p className="leading-relaxed">
                Firebase Authentication requires adding{' '}
                <code className="font-mono-tabular font-semibold px-1 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60">
                  {unauthorizedHost}
                </code>{' '}
                under Authentication → Settings → Authorized domains.
              </p>
              <a
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-[#3061d0] dark:text-blue-400 hover:underline"
              >
                <span>Open Firebase Auth Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3 rounded-md border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs font-medium text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-[#3061d0] hover:bg-[#2752b4] disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <div className="mt-7 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#3061d0] shrink-0" />
              <span>AES-256-GCM encrypted file vault &amp; SHA-256 verification</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3061d0] shrink-0" />
              <span>Role-based stakeholder access &amp; real-time cloud sync</span>
            </div>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-zinc-200/70 dark:border-zinc-800/70">
          <button
            type="button"
            onClick={onNavigateArchive}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-[#3061d0] dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <span>Browse Public Archive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

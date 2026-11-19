import React, { useEffect, useState } from 'react';
import { getRedirectResult, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { AlertTriangle, ArrowRight, ExternalLink, Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { auth, FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID, googleProvider } from '../firebase';
import { BrandMark } from './BrandMark';

interface LoginViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateArchive: () => void;
  externalError?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  darkMode,
  onToggleDarkMode,
  onNavigateArchive,
  externalError,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);

  const combinedError = errorMsg || externalError || null;
  const isQuotaExceeded = Boolean(
    combinedError &&
      (combinedError.includes('resource-exhausted') ||
        combinedError.toLowerCase().includes('quota'))
  );

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#0f1210] dark:text-[#f3f0e9]">
      {/* Left Brand Visual Panel */}
      <div className="relative lg:flex-[1.2] min-h-[260px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-10 bg-[#0c0e0c] text-[#f3f0e9] overflow-hidden">
        <img
          src="/assets/aistudio/kanhaiya-sharma-EiAqej-cGks-unsplash_c5de0270.jpg"
          alt="IMnexus architectural nexus structure"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/35 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <BrandMark className="text-[14px] text-[#f3f0e9]" />
        </div>

        <div className="relative z-10 mt-10 lg:mt-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#c4bfb4] mb-2">
            Case Management · Evidence Archive
          </div>
          <h2 className="text-2xl sm:text-[30px] font-semibold tracking-[-0.02em] leading-tight max-w-sm [text-wrap:balance]">
            Every dossier, record, and nexus in continuity.
          </h2>
          <p className="text-xs text-[#c4bfb4] mt-3">
            Private console · Encrypted vault · Public archive · Visual nexus
          </p>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="w-full lg:w-[460px] shrink-0 flex flex-col justify-between p-7 sm:p-12 bg-[#faf8f4] dark:bg-[#111413] border-t lg:border-t-0 lg:border-l border-[#ddd8ce] dark:border-[#262b27]">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle color theme"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] bg-[#f3f0e9] dark:bg-[#161916] text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210] dark:hover:border-[#8d948e] transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        <div className="w-full max-w-[340px] mx-auto my-8">
          <div className="mb-7">
            <BrandMark className="text-[16px] text-[#0f1210] dark:text-[#f3f0e9]" />
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em] leading-tight mb-2">
            Console Sign In
          </h1>
          <p className="text-[13px] text-[#6a716b] dark:text-[#8d948e] leading-relaxed mb-8">
            Authenticate to access structured case dossiers, the encrypted evidence vault, visual nexus mapping, and public site publishing.
          </p>

          {unauthorizedHost && (
            <div className="mb-5 p-3.5 border border-[#d4c9a8] dark:border-[#635125] bg-[#f3f0e9] dark:bg-[#1b1912] text-xs text-[#7a642e] dark:text-[#d4bc7d] space-y-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Authorize Deployment Domain</span>
              </div>
              <p className="leading-relaxed">
                Firebase Authentication requires adding{' '}
                <code className="font-mono-tabular font-semibold px-1 py-0.5 bg-[#e9e5db] dark:bg-[#2a2519]">
                  {unauthorizedHost}
                </code>{' '}
                under Authentication → Settings → Authorized domains.
              </p>
              <a
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#1a2e24] dark:text-[#7fb892] hover:underline"
              >
                <span>Open Firebase Auth Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {isQuotaExceeded ? (
            <div className="mb-5 p-3.5 border border-[#d4c9a8] dark:border-[#635125] bg-[#f3f0e9] dark:bg-[#1b1912] text-xs text-[#7a642e] dark:text-[#d4bc7d] space-y-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Firestore Daily Free Quota Reached</span>
              </div>
              <p className="leading-relaxed">
                The project&apos;s free daily Cloud Firestore write limit has been reached. Free tier quotas reset daily, or you can inspect your database usage in Firebase Console.
              </p>
              <a
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#1a2e24] dark:text-[#7fb892] hover:underline"
              >
                <span>View Firestore Database</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            combinedError && (
              <div className="mb-5 p-3 border border-[#8b3a3a]/40 bg-[#8b3a3a]/10 text-xs font-medium text-[#8b3a3a] dark:text-[#e38b8b] break-words">
                {combinedError}
              </div>
            )
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 disabled:opacity-50 text-[13px] font-medium transition-opacity cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>{loading ? 'Signing in…' : 'Sign in with Google'}</span>
          </button>

          <div className="mt-8 pt-6 border-t border-[#e9e5db] dark:border-[#242924] space-y-2.5 text-xs text-[#6a716b] dark:text-[#8d948e]">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892] shrink-0" />
              <span>AES-256-GCM encrypted file vault &amp; SHA-256 verification</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2d5a3d] dark:text-[#7fb892] shrink-0" />
              <span>Role-based stakeholder access &amp; real-time cloud sync</span>
            </div>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-[#e9e5db] dark:border-[#242924]">
          <button
            type="button"
            onClick={onNavigateArchive}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0f1210] dark:text-[#f3f0e9] hover:text-[#2d5a3d] dark:hover:text-[#7fb892] transition-colors cursor-pointer"
          >
            <span>Browse Public Archive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

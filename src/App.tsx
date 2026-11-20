import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { ensureUserProfile } from './services/firestoreService';
import type { UserProfile } from './types';
import { ConsoleApp } from './components/ConsoleApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { PublicArchiveDirectory } from './components/PublicArchiveDirectory';
import { PublicSiteView } from './components/PublicSiteView';

type AppRoute =
  | { kind: 'console' }
  | { kind: 'archive' }
  | { kind: 'site'; slug: string };

function parseRouteFromLocation(): AppRoute {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/site/')) {
    const slug = decodeURIComponent(pathname.slice(6).replace(/\/+$/, ''));
    if (slug) return { kind: 'site', slug };
  }
  if (pathname === '/archive') {
    return { kind: 'archive' };
  }
  return { kind: 'console' };
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromLocation());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('imnexus_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('imnexus_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage failures
    }
  }, [darkMode]);

  useEffect(() => {
    const handlePop = () => setRoute(parseRouteFromLocation());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setProfileError(null);
      if (user) {
        try {
          const profile = await ensureUserProfile(user);
          setUserProfile(profile);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
          setUserProfile(null);
          setProfileError(
            err instanceof Error ? err.message : 'Unable to sync account with Cloud Firestore.'
          );
        }
      } else {
        setUserProfile(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const navigateTo = (next: AppRoute, hash?: string) => {
    const basePath =
      next.kind === 'site'
        ? `/site/${encodeURIComponent(next.slug)}`
        : next.kind === 'archive'
        ? '/archive'
        : '/';
    const fullPath = hash ? `${basePath}${hash}` : basePath;
    window.history.pushState({}, '', fullPath);
    setRoute(next);
    if (hash) {
      const targetId = hash.replace(/^#/, '');
      window.setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <ErrorBoundary>
      {route.kind === 'site' ? (
        <PublicSiteView
          slug={route.slug}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigateArchive={(hash) => navigateTo({ kind: 'archive' }, hash)}
          onNavigateConsole={() => navigateTo({ kind: 'console' })}
          isAuthenticated={Boolean(firebaseUser)}
        />
      ) : route.kind === 'archive' ? (
        <PublicArchiveDirectory
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenSite={(slug) => navigateTo({ kind: 'site', slug })}
          onNavigateConsole={() => navigateTo({ kind: 'console' })}
          isAuthenticated={Boolean(firebaseUser)}
        />
      ) : !authReady ? (
        <div className="min-h-screen flex items-center justify-center bg-[#f3f0e9] dark:bg-[#0c0e0c] text-[#6a716b] dark:text-[#8d948e] text-xs tracking-wide">
          Initializing IMnexus…
        </div>
      ) : !firebaseUser || !userProfile ? (
        <LoginView
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigateArchive={() => navigateTo({ kind: 'archive' })}
          externalError={profileError}
        />
      ) : (
        <ConsoleApp
          firebaseUser={firebaseUser}
          userProfile={userProfile}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onOpenPublicSite={(slug) => navigateTo({ kind: 'site', slug })}
          onOpenPublicArchive={() => navigateTo({ kind: 'archive' })}
        />
      )}
    </ErrorBoundary>
  );
}

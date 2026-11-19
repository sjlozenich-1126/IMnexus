import React, { Component, type ReactNode } from 'react';
import { FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID } from '../firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      let parsedDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string; path?: string };
        if (parsed?.error) {
          parsedDetail = `${parsed.error}${parsed.path ? ` (Path: ${parsed.path})` : ''}`;
        }
      } catch {
        // Plain error message
      }

      const isQuotaError =
        parsedDetail.includes('resource-exhausted') ||
        parsedDetail.toLowerCase().includes('quota');

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f3f0e9] dark:bg-[#0c0e0c] p-6">
          <div className="max-w-lg w-full bg-[#faf8f4] dark:bg-[#161916] border border-[#ddd8ce] dark:border-[#262b27] p-6">
            <div className="text-xs font-semibold tracking-[0.14em] uppercase mb-2 text-[#0f1210] dark:text-[#f3f0e9]">
              IM<span className="font-normal lowercase tracking-[0.06em]">nexus</span>
            </div>
            <h1 className="text-base font-semibold text-[#0f1210] dark:text-[#f3f0e9] mb-2">
              {isQuotaError ? 'Firestore Daily Free Quota Reached' : 'Session Interrupted'}
            </h1>
            <p className="text-[13px] text-[#6a716b] dark:text-[#8d948e] mb-5 break-words leading-relaxed">
              {isQuotaError
                ? 'The project’s free daily Cloud Firestore quota has been reached. Free tier quotas reset the next day.'
                : parsedDetail}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-medium bg-[#0f1210] dark:bg-[#f3f0e9] text-[#faf8f4] dark:text-[#0f1210] hover:opacity-85 transition-opacity cursor-pointer"
              >
                Reload Application
              </button>
              {isQuotaError && (
                <a
                  href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 text-xs font-medium border border-[#ddd8ce] dark:border-[#262b27] text-[#0f1210] dark:text-[#f3f0e9] hover:border-[#0f1210]"
                >
                  Open Firestore Console
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

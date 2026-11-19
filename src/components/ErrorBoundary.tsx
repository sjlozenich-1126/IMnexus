import React, { Component, type ReactNode } from 'react';

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

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] dark:bg-[#09090b] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm font-bold tracking-tight mb-2">
              <span className="font-extrabold uppercase">IM</span>
              <span className="font-normal lowercase">nexus</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Session Interrupted
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 break-words">
              {parsedDetail}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-[#3061d0] text-white hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

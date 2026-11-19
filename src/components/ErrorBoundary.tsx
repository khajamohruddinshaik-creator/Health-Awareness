import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F9F7] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#F2CFCB] rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2.5 text-[#9E2A22]">
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-bold">Application Error</h1>
            </div>
            <p className="text-sm text-[#495D52] leading-relaxed">
              Something went wrong while communicating with the database or
              rendering this view.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 min-h-10 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

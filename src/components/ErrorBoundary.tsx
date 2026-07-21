import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, an uncaught render error produces a silent blank white
// screen in production (no dev overlay, no visible message) — a business
// user has no way to know what happened or report it usefully.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white shadow rounded-lg p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">حدث خطأ غير متوقع</h1>
            <p className="text-gray-600 text-sm">
              تعذر تحميل التطبيق. حاول تحديث الصفحة، وإذا استمرت المشكلة أبلغ فريق الدعم بالتفاصيل التالية:
            </p>
            <pre className="text-left text-xs bg-gray-100 rounded p-3 overflow-x-auto text-red-700" dir="ltr">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-5 py-2 text-sm font-bold transition"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function formatFriendlyError(rawMessage: string): string {
  try {
    const parsed = JSON.parse(rawMessage) as { error?: string; operationType?: string };
    if (parsed.error?.toLowerCase().includes('permission')) {
      return 'Bulut kitaplığınıza erişim sırasında yetki doğrulaması başarısız oldu. Lütfen hesabınızla tekrar giriş yapmayı deneyin.';
    }
    if (parsed.error?.toLowerCase().includes('offline')) {
      return 'İnternet bağlantısı veya bulut sunucusuyla iletişim kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.';
    }
  } catch {
    // Plain error message
  }
  return 'Beklenmeyen bir hata oluştu. Sayfayı yenileyerek devam edebilirsiniz.';
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: formatFriendlyError(error.message),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Rafİzi ErrorBoundary caught error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-editorial text-xl font-medium text-zinc-950">
              Bir sorunla karşılaşıldı
            </h1>
            <p className="text-sm text-zinc-600 leading-relaxed">{this.state.message}</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            <span>Sayfayı Yenile</span>
          </button>
        </div>
      </div>
    );
  }
}

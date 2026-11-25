import { BookMarked, Camera, Cloud, MapPin, ScanBarcode } from 'lucide-react';

interface SignInViewProps {
  signingIn: boolean;
  authError: string | null;
  onSignInWithGoogle: () => void;
  onEnterPreview: () => void;
}

export function GoogleLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export function SignInView({
  signingIn,
  authError,
  onSignInWithGoogle,
  onEnterPreview,
}: SignInViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-900">
      <header className="border-b border-zinc-200 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="font-editorial text-2xl font-semibold tracking-tight text-zinc-900">
            Rafİzi
          </span>
          <button
            type="button"
            onClick={onSignInWithGoogle}
            disabled={signingIn}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-zinc-800 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
          >
            <GoogleLogo className="w-4 h-4 shrink-0" />
            <span>{signingIn ? 'Giriş yapılıyor...' : 'Google ile Giriş Yap'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left: Editorial Headline + Sign-in Card */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-900 font-medium">
                Kişisel Kitaplık Kataloğu ve Raf Bulucu
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl lg:text-[42px] leading-[1.12] font-medium tracking-tight text-zinc-950 text-balance">
                Kitaplığınız ve okuma listeniz Google hesabınızla her cihazda sizinle.
              </h1>
              <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
                Raflarınızın fotoğrafını çekin veya barkodları okutun; kitaplarınız yazar,
                yayınevi ve raf konumuyla birlikte yalnızca size özel bulut arşivinizde
                saklansın.
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                {authError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onSignInWithGoogle}
                disabled={signingIn}
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-950 rounded-xl transition-colors whitespace-nowrap disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
              >
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                  <GoogleLogo className="w-3.5 h-3.5" />
                </span>
                <span>{signingIn ? 'Bağlanılıyor...' : 'Google ile Giriş Yap'}</span>
              </button>

              <button
                type="button"
                onClick={onEnterPreview}
                className="inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:text-zinc-950 rounded-xl transition-colors whitespace-nowrap"
              >
                Örnek kitaplığı incele
              </button>
            </div>

            <div className="pt-4 border-t border-zinc-200 grid grid-cols-2 gap-4 text-xs text-zinc-600">
              <div className="flex items-start gap-2.5">
                <Camera className="w-4 h-4 text-emerald-900 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Tek fotoğrafla tüm rafı tarayın, kitap sırtlarını otomatik tanıyın.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-900 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Kitap adını yazın, hangi kitaplıkta ve kaçıncı rafta olduğunu anında görün.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ScanBarcode className="w-4 h-4 text-emerald-900 shrink-0 mt-0.5" aria-hidden="true" />
                <span>ISBN barkodlarıyla yazar, yayınevi ve sayfa bilgilerini hızla ekleyin.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Cloud className="w-4 h-4 text-emerald-900 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Her kullanıcının kitaplığı ve okuma listesi kendi hesabında güvenle tutulur.</span>
              </div>
            </div>
          </div>

          {/* Right: Editorial Bookshelf Preview Frame */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="relative aspect-[4/3] bg-zinc-100 overflow-hidden">
                <img
                  src="/src/assets/images/sample_salon_shelf_1795607930908.jpg"
                  alt="Rafİzi kitaplık raf taraması önizlemesi"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/65 via-zinc-950/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-xs border border-zinc-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-900 font-medium">
                      Bulut Raf Haritası
                    </p>
                    <p className="font-editorial text-sm sm:text-base font-medium text-zinc-950 truncate">
                      Saatleri Ayarlama Enstitüsü — Salon Kitaplığı · 2. Raf · Sol
                    </p>
                  </div>
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-900/10 text-emerald-900 flex items-center justify-center">
                    <BookMarked className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

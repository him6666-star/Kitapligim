import { useEffect, useRef, useState } from 'react';
import { Camera, Cloud, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ActiveTab } from '../types/library';
import { GoogleLogo } from './SignInView';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
  user: User | null;
  signingIn: boolean;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'katalog', label: 'Katalog' },
  { id: 'raf-haritasi', label: 'Raf Haritası' },
  { id: 'okuma-listesi', label: 'Okuma Listesi' },
  { id: 'dizin', label: 'Dizin' },
];

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || 'R').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Header({
  activeTab,
  onSelectTab,
  onOpenScanner,
  user,
  signingIn,
  onSignInWithGoogle,
  onSignOut,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-[#FAFAFA]/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('katalog')}
          className="font-editorial text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 rounded"
        >
          Rafİzi
        </button>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav
          aria-label="Ana gezinme"
          className="hidden md:flex items-center gap-7 text-sm font-medium h-full"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative h-full inline-flex items-center whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 rounded ${
                  isActive
                    ? 'text-zinc-950 font-semibold'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-emerald-900"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary scan action + Google account control */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Kitap Tara</span>
          </button>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Hesap menüsü"
                className="inline-flex items-center gap-2 pl-1.5 pr-2 sm:pr-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors whitespace-nowrap shrink-0"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? 'Hesap'}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-md bg-emerald-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {getInitials(user.displayName, user.email)}
                  </span>
                )}
                <span className="hidden lg:inline text-xs font-medium text-zinc-700 max-w-[110px] truncate">
                  {user.displayName?.split(' ')[0] ?? 'Hesabım'}
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl shadow-lg p-3 space-y-3 z-40"
                >
                  <div className="pb-2.5 border-b border-zinc-100">
                    <p className="text-sm font-medium text-zinc-950 truncate">
                      {user.displayName ?? 'Rafİzi Okuru'}
                    </p>
                    {user.email && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
                    )}
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-900 font-medium">
                      <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Kitaplığınız bulutta güvende</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full inline-flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Çıkış Yap</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignInWithGoogle}
              disabled={signingIn}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-zinc-800 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <GoogleLogo className="w-3.5 h-3.5 shrink-0" />
              <span>{signingIn ? 'Bağlanıyor...' : 'Giriş Yap'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact single-row mobile navigation (keeps total sticky height <= 96px on mobile) */}
      <nav
        aria-label="Mobil gezinme"
        className="md:hidden border-t border-zinc-200/80 px-2 flex items-center justify-around bg-[#FAFAFA]"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-2.5 px-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-emerald-900 text-zinc-950 font-semibold'
                  : 'border-transparent text-zinc-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

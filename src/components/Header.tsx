import { Camera } from 'lucide-react';
import type { ActiveTab } from '../types/library';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'katalog', label: 'Katalog' },
  { id: 'raf-haritasi', label: 'Raf Haritası' },
  { id: 'okuma-listesi', label: 'Okuma Listesi' },
  { id: 'dizin', label: 'Dizin' },
];

export function Header({ activeTab, onSelectTab, onOpenScanner }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAFAFA]/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
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

        {/* Zone 3: 1 primary CTA button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Kitap Tara</span>
          </button>
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

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { DirectoryEntry } from '../lib/libraryUtils';

interface DirectoryViewProps {
  byPublisher: DirectoryEntry[];
  byAuthor: DirectoryEntry[];
  byCategory: DirectoryEntry[];
  onFilterByPublisher: (publisher: string) => void;
  onFilterByAuthor: (author: string) => void;
  onFilterByCategory: (category: string) => void;
}

export function DirectoryView({
  byPublisher,
  byAuthor,
  byCategory,
  onFilterByPublisher,
  onFilterByAuthor,
  onFilterByCategory,
}: DirectoryViewProps) {
  const [groupBy, setGroupBy] = useState<'yayinevi' | 'yazar' | 'kategori'>('yayinevi');

  const entries =
    groupBy === 'yayinevi'
      ? byPublisher
      : groupBy === 'yazar'
      ? byAuthor
      : byCategory;

  function handleSelect(name: string) {
    if (groupBy === 'yayinevi') onFilterByPublisher(name);
    else if (groupBy === 'yazar') onFilterByAuthor(name);
    else onFilterByCategory(name);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-editorial text-2xl font-medium text-zinc-950">
            Kütüphane Dizini
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Kitaplarınızı yayınevine, yazara veya kategoriye göre gruplanmış biçimde inceleyin.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Dizin gruplama seçimi"
          className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={groupBy === 'yayinevi'}
            onClick={() => setGroupBy('yayinevi')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              groupBy === 'yayinevi'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Yayınevleri ({byPublisher.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={groupBy === 'yazar'}
            onClick={() => setGroupBy('yazar')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              groupBy === 'yazar'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Yazarlar ({byAuthor.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={groupBy === 'kategori'}
            onClick={() => setGroupBy('kategori')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              groupBy === 'kategori'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Kategoriler ({byCategory.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => handleSelect(entry.name)}
            className="text-left bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl p-5 transition-colors group focus-visible:outline-2 focus-visible:outline-emerald-800"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-base text-zinc-950 group-hover:text-emerald-900 transition-colors">
                {entry.name}
              </h3>
              <ArrowRight
                className="w-4 h-4 text-zinc-400 group-hover:text-emerald-900 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>

            <div className="mt-1.5 text-xs text-zinc-500 font-mono tabular-nums flex items-center gap-2">
              <span>{entry.count} kitap</span>
              <span aria-hidden="true">·</span>
              <span>{entry.readCount} okundu</span>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-600 truncate">
              {entry.books
                .slice(0, 3)
                .map((b) => b.title)
                .join(', ')}
              {entry.books.length > 3 ? ` +${entry.books.length - 3}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

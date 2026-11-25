import { MapPin, Search, X } from 'lucide-react';
import type { Book, Bookcase } from '../types/library';
import { formatShelfLocation } from '../lib/libraryUtils';

interface BookLocatorBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  quickMatches: Book[];
  bookcases: Bookcase[];
  onLocateBook: (book: Book) => void;
  onSelectBook: (book: Book) => void;
  totalCount: number;
  suppressDropdown?: boolean;
}

export function BookLocatorBar({
  query,
  onQueryChange,
  quickMatches,
  bookcases,
  onLocateBook,
  onSelectBook,
  totalCount,
  suppressDropdown = false,
}: BookLocatorBarProps) {
  const hasQuery = query.trim().length > 0;
  const showDropdown = hasQuery && quickMatches.length > 0 && !suppressDropdown;

  return (
    <section aria-label="Kitap ve raf konumu arama" className="w-full">
      <div className="relative">
        <label htmlFor="book-locator-search" className="sr-only">
          Kitap adı, yazar, yayınevi veya ISBN ile raf konumu ara
        </label>
        <Search
          className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="book-locator-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={`Kitaplığında ara (${totalCount} kitap): kitap adı, yazar, yayınevi veya ISBN...`}
          className="w-full h-12 pl-12 pr-11 bg-white border border-zinc-300 rounded-xl text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15 transition-colors"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Aramayı temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 rounded-md focus-visible:outline-2 focus-visible:outline-emerald-800"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Instant Shelf-Location Readout when typing */}
      {showDropdown && (
        <div
          data-testid="locator-instant-results"
          className="mt-3 bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100"
        >
          <div className="px-4 py-2.5 flex items-center justify-between text-xs text-zinc-500">
            <span>
              <strong className="font-semibold text-zinc-800 tabular-nums">
                {quickMatches.length}
              </strong>{' '}
              kitabın raf konumu bulundu
            </span>
            <span>Doğrudan rafta görmek için “Rafta Göster”e tıklayın</span>
          </div>
          {quickMatches.slice(0, 4).map((book) => (
            <div
              key={book.id}
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-zinc-50/80 transition-colors"
            >
              <button
                type="button"
                onClick={() => onSelectBook(book)}
                className="text-left min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-emerald-800 rounded"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-medium text-sm text-zinc-950">{book.title}</span>
                  <span className="text-xs text-zinc-500">
                    {book.author} · {book.publisher}
                  </span>
                </div>
                <p className="mt-1 text-xs font-mono text-emerald-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{formatShelfLocation(book, bookcases)}</span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => onLocateBook(book)}
                aria-label={`${book.title} kitabını rafta göster`}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-950 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-800"
              >
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Rafta Göster</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

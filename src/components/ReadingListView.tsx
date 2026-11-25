import { useState } from 'react';
import { Check, MapPin, Star } from 'lucide-react';
import type { Book, Bookcase, ReadingStatus } from '../types/library';
import {
  calculateReadingProgress,
  formatShortLocation,
  isLightHexColor,
} from '../lib/libraryUtils';

interface ReadingListViewProps {
  books: Book[];
  bookcases: Bookcase[];
  stats: {
    readBooks: number;
    readingBooks: number;
    toReadBooks: number;
    totalPagesRead: number;
  };
  onUpdateProgress: (bookId: string, nextPage: number) => void;
  onUpdateStatus: (bookId: string, status: ReadingStatus) => void;
  onUpdateRating: (bookId: string, rating: number) => void;
  onSelectBook: (book: Book) => void;
  onLocateBook: (book: Book) => void;
}

export function ReadingListView({
  books,
  bookcases,
  stats,
  onUpdateProgress,
  onUpdateStatus,
  onUpdateRating,
  onSelectBook,
  onLocateBook,
}: ReadingListViewProps) {
  const [segment, setSegment] = useState<'tumu' | ReadingStatus>('okunuyor');
  const [pageDrafts, setPageDrafts] = useState<Record<string, string>>({});

  const visibleBooks = books.filter((b) =>
    segment === 'tumu' ? true : b.readingStatus === segment
  );

  function commitPageDraft(book: Book) {
    const raw = pageDrafts[book.id];
    if (raw === undefined) return;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdateProgress(book.id, parsed);
    }
    setPageDrafts((prev) => {
      const next = { ...prev };
      delete next[book.id];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Editorial Summary Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        <div className="p-4 sm:p-5">
          <div className="text-xs text-zinc-500">Şu An Okunan</div>
          <div
            data-testid="stat-reading-count"
            className="mt-1 font-editorial text-2xl sm:text-3xl font-medium text-zinc-950 tabular-nums"
          >
            {stats.readingBooks}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-zinc-500">Okunacak Kuyruğu</div>
          <div
            data-testid="stat-toread-count"
            className="mt-1 font-editorial text-2xl sm:text-3xl font-medium text-zinc-950 tabular-nums"
          >
            {stats.toReadBooks}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-zinc-500">Tamamlanan Kitap</div>
          <div
            data-testid="stat-read-count"
            className="mt-1 font-editorial text-2xl sm:text-3xl font-medium text-emerald-900 tabular-nums"
          >
            {stats.readBooks}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="text-xs text-zinc-500">Toplam Okunan Sayfa</div>
          <div className="mt-1 font-mono text-2xl sm:text-3xl font-medium text-zinc-950 tabular-nums">
            {stats.totalPagesRead.toLocaleString('tr-TR')}
          </div>
        </div>
      </div>

      {/* Segmented Status Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Okuma listesi bölümleri"
          className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto max-w-full"
        >
          {(
            [
              { id: 'okunuyor', label: `Okunuyor (${stats.readingBooks})` },
              { id: 'okunacak', label: `Okunacak (${stats.toReadBooks})` },
              { id: 'okundu', label: `Okundu (${stats.readBooks})` },
              { id: 'tumu', label: `Tümü (${books.length})` },
            ] as const
          ).map((tab) => {
            const active = segment === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  active
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reading Cards / Rows */}
      {visibleBooks.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl px-6 py-12 text-center">
          <h3 className="font-editorial text-lg font-medium text-zinc-900">
            Bu listede henüz kitap yok
          </h3>
          <p className="mt-1.5 text-sm text-zinc-500">
            Katalogdaki herhangi bir kitabın okuma durumunu değiştirerek buradan takip edebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200/80">
          {visibleBooks.map((book) => {
            const pct = calculateReadingProgress(book.currentPage, book.pageCount);
            const lightSpine = isLightHexColor(book.spineColor);
            const draftVal =
              pageDrafts[book.id] !== undefined
                ? pageDrafts[book.id]
                : String(book.currentPage);

            return (
              <article
                key={book.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className={`w-3.5 h-12 rounded-[3px] shrink-0 mt-0.5 ${
                      lightSpine ? 'border border-zinc-300' : ''
                    }`}
                    style={{ backgroundColor: book.spineColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectBook(book)}
                      className="text-left font-medium text-base text-zinc-950 hover:text-emerald-900 transition-colors"
                    >
                      {book.title}
                    </button>
                    <div className="mt-0.5 text-xs text-zinc-600 flex items-center gap-1.5 flex-wrap">
                      <span>{book.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>{book.publisher}</span>
                      <span aria-hidden="true">·</span>
                      <span>{book.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-emerald-900">
                        {formatShortLocation(book, bookcases)}
                      </span>
                    </div>

                    {/* Progress bar for currently reading books */}
                    {book.readingStatus === 'okunuyor' && (
                      <div className="mt-3 max-w-md space-y-2">
                        <div className="flex items-center justify-between text-xs text-zinc-600 font-mono tabular-nums">
                          <span>
                            Sayfa {book.currentPage}
                            {book.pageCount ? ` / ${book.pageCount}` : ''}
                          </span>
                          {book.pageCount && <span>%{pct}</span>}
                        </div>
                        {book.pageCount && (
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-800 rounded-full transition-all duration-200"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes preview */}
                    {book.notes && (
                      <p className="mt-2 text-xs text-zinc-500 italic line-clamp-2">
                        “{book.notes}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Right-side Reading Actions */}
                <div className="flex flex-wrap items-center gap-2 pl-7 lg:pl-0 shrink-0">
                  {book.readingStatus === 'okunuyor' && (
                    <>
                      <div className="inline-flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50">
                        <label htmlFor={`page-input-${book.id}`} className="sr-only">
                          {book.title} güncel sayfa
                        </label>
                        <input
                          id={`page-input-${book.id}`}
                          type="number"
                          min={0}
                          max={book.pageCount || 9999}
                          value={draftVal}
                          onChange={(e) =>
                            setPageDrafts((prev) => ({ ...prev, [book.id]: e.target.value }))
                          }
                          onBlur={() => commitPageDraft(book)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitPageDraft(book);
                          }}
                          className="w-16 h-8 px-2 text-xs font-mono tabular-nums text-center bg-white border-r border-zinc-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateProgress(book.id, book.currentPage + 10)}
                          aria-label={`${book.title} için 10 sayfa ilerle`}
                          className="h-8 px-2.5 text-xs font-mono font-medium text-zinc-700 hover:bg-zinc-200/70 transition-colors"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateProgress(book.id, book.currentPage + 25)}
                          aria-label={`${book.title} için 25 sayfa ilerle`}
                          className="h-8 px-2.5 text-xs font-mono font-medium text-zinc-700 hover:bg-zinc-200/70 border-l border-zinc-200 transition-colors"
                        >
                          +25
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onUpdateStatus(book.id, 'okundu')}
                        aria-label={`${book.title} kitabını okundu olarak işaretle`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Bitirdim</span>
                      </button>
                    </>
                  )}

                  {book.readingStatus === 'okunacak' && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(book.id, 'okunuyor')}
                      aria-label={`${book.title} kitabını okumaya başla`}
                      className="h-8 px-3 text-xs font-medium text-emerald-950 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Okumaya Başla
                    </button>
                  )}

                  {book.readingStatus === 'okundu' && (
                    <div
                      role="group"
                      aria-label={`${book.title} puanı`}
                      className="inline-flex items-center gap-0.5 mr-1"
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = (book.rating ?? 0) >= star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => onUpdateRating(book.id, star)}
                            aria-label={`${book.title} için ${star} yıldız ver`}
                            className="p-1 rounded hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-800"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                filled
                                  ? 'fill-amber-500 text-amber-500'
                                  : 'text-zinc-300'
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onLocateBook(book)}
                    aria-label={`${book.title} kitabını rafta göster`}
                    className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200/70 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Rafta Göster</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

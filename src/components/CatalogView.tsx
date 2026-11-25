import { Camera, MapPin, RotateCcw, ScanBarcode } from 'lucide-react';
import type {
  Book,
  Bookcase,
  CatalogFilters,
  ReadingStatus,
  SortOption,
} from '../types/library';
import { READING_STATUS_LABELS, SOURCE_LABELS } from '../types/library';
import {
  calculateReadingProgress,
  isLightHexColor,
} from '../lib/libraryUtils';

interface CatalogViewProps {
  books: Book[];
  allBooksCount: number;
  bookcases: Bookcase[];
  filters: CatalogFilters;
  sortBy: SortOption;
  categories: string[];
  authors: string[];
  publishers: string[];
  onFilterChange: (patch: Partial<CatalogFilters>) => void;
  onResetFilters: () => void;
  onSortChange: (sort: SortOption) => void;
  onSelectBook: (book: Book) => void;
  onLocateBook: (book: Book) => void;
  onQuickStatusChange: (bookId: string, status: ReadingStatus) => void;
  onOpenScanner: (initialMode?: 'raf-fotografi' | 'barkod' | 'manuel') => void;
}

export function CatalogView({
  books,
  allBooksCount,
  bookcases,
  filters,
  sortBy,
  categories,
  authors,
  publishers,
  onFilterChange,
  onResetFilters,
  onSortChange,
  onSelectBook,
  onLocateBook,
  onQuickStatusChange,
  onOpenScanner,
}: CatalogViewProps) {
  const hasActiveFilter = Boolean(
    filters.query ||
      filters.category ||
      filters.author ||
      filters.publisher ||
      filters.bookcaseId ||
      filters.shelfRow !== null ||
      filters.readingStatus !== 'tumu' ||
      filters.source !== 'tumu'
  );

  return (
    <div className="space-y-6">
      {/* Multi-facet Filter Controls */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="filter-category" className="block text-xs font-medium text-zinc-600 mb-1">
              Kategori
            </label>
            <select
              id="filter-category"
              value={filters.category}
              onChange={(e) => onFilterChange({ category: e.target.value })}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-emerald-800"
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-publisher" className="block text-xs font-medium text-zinc-600 mb-1">
              Yayınevi
            </label>
            <select
              id="filter-publisher"
              value={filters.publisher}
              onChange={(e) => onFilterChange({ publisher: e.target.value })}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-emerald-800"
            >
              <option value="">Tüm Yayınevleri</option>
              {publishers.map((pub) => (
                <option key={pub} value={pub}>
                  {pub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-author" className="block text-xs font-medium text-zinc-600 mb-1">
              Yazar
            </label>
            <select
              id="filter-author"
              value={filters.author}
              onChange={(e) => onFilterChange({ author: e.target.value })}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-emerald-800"
            >
              <option value="">Tüm Yazarlar</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-bookcase" className="block text-xs font-medium text-zinc-600 mb-1">
              Kitaplık
            </label>
            <select
              id="filter-bookcase"
              value={filters.bookcaseId}
              onChange={(e) => onFilterChange({ bookcaseId: e.target.value, shelfRow: null })}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-emerald-800"
            >
              <option value="">Tüm Kitaplıklar</option>
              {bookcases.map((bc) => (
                <option key={bc.id} value={bc.id}>
                  {bc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="catalog-sort" className="block text-xs font-medium text-zinc-600 mb-1">
              Sıralama
            </label>
            <select
              id="catalog-sort"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-emerald-800"
            >
              <option value="raf-sirasi">Raf Sırasına Göre</option>
              <option value="baslik-az">Kitap Adı (A–Z)</option>
              <option value="yazar-az">Yazar (A–Z)</option>
              <option value="yayinevi-az">Yayınevi (A–Z)</option>
              <option value="son-eklenen">Son Eklenenler</option>
            </select>
          </div>
        </div>

        {/* Status segmented filter + summary */}
        <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Okuma durumu filtresi"
            className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto max-w-full"
          >
            {(
              [
                { value: 'tumu', label: 'Tümü' },
                { value: 'okunuyor', label: 'Okunuyor' },
                { value: 'okunacak', label: 'Okunacak' },
                { value: 'okundu', label: 'Okundu' },
              ] as const
            ).map((opt) => {
              const active = filters.readingStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFilterChange({ readingStatus: opt.value })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="tabular-nums">
              Gösterilen: <strong className="text-zinc-900 font-semibold">{books.length}</strong> /{' '}
              {allBooksCount} kitap
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 text-emerald-900 hover:text-emerald-700 font-medium whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Filtreleri Temizle</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Catalog List */}
      {books.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl px-6 py-14 text-center">
          <h3 className="font-editorial text-xl font-medium text-zinc-900">
            {hasActiveFilter ? 'Eşleşen kitap bulunamadı' : 'Kitaplığınız henüz boş'}
          </h3>
          <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
            {hasActiveFilter
              ? 'Seçili filtreleri temizleyerek tüm kitapları görebilir veya aradığınız kitabı yeni kayıt olarak ekleyebilirsiniz.'
              : 'Kitaplığınızın fotoğrafını çekerek tüm rafları tek seferde kaydedin ya da arka kapaktaki barkodu okutun.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap"
              >
                Tüm Kitapları Göster
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenScanner('raf-fotografi')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Raf Fotoğrafı Tara</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScanner('barkod')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-800 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <ScanBarcode className="w-4 h-4" aria-hidden="true" />
                  <span>Barkod Okut</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          data-testid="catalog-list"
          className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200/80"
        >
          {/* Desktop table column header */}
          <div className="hidden lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_140px_124px] gap-4 px-5 py-3 bg-zinc-50 text-xs font-medium text-zinc-500">
            <span>Kitap ve Yazar</span>
            <span>Yayınevi ve Kategori</span>
            <span>Raf Konumu</span>
            <span>Okuma Durumu</span>
            <span className="text-right">İşlem</span>
          </div>

          {books.map((book) => {
            const pct = calculateReadingProgress(book.currentPage, book.pageCount);
            const lightSpine = isLightHexColor(book.spineColor);
            return (
              <div
                key={book.id}
                className="px-4 sm:px-5 py-3.5 grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_140px_124px] gap-3 lg:gap-4 items-start lg:items-center hover:bg-zinc-50/70 transition-colors"
              >
                {/* Title + Author + Spine Swatch */}
                <button
                  type="button"
                  onClick={() => onSelectBook(book)}
                  className="flex items-start gap-3 text-left min-w-0 group focus-visible:outline-2 focus-visible:outline-emerald-800 rounded"
                >
                  <span
                    aria-hidden="true"
                    className={`w-3.5 h-11 rounded-[3px] shrink-0 mt-0.5 ${
                      lightSpine ? 'border border-zinc-300' : ''
                    }`}
                    style={{ backgroundColor: book.spineColor }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm sm:text-[15px] text-zinc-950 group-hover:text-emerald-900 transition-colors truncate">
                      {book.title}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-600 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{book.author}</span>
                      {book.isbn && (
                        <>
                          <span aria-hidden="true" className="text-zinc-300">
                            ·
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {book.isbn}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                {/* Publisher & Category (clean unboxed metadata) */}
                <div className="text-xs text-zinc-600 min-w-0 pl-6 lg:pl-0">
                  <div className="text-zinc-900 font-medium truncate">{book.publisher}</div>
                  <div className="mt-0.5 text-zinc-500 flex items-center gap-1.5">
                    <span>{book.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{SOURCE_LABELS[book.source]}</span>
                  </div>
                </div>

                {/* Physical Shelf Location */}
                <div className="pl-6 lg:pl-0 min-w-0">
                  <div className="text-xs font-medium text-zinc-900 truncate">
                    {bookcases.find((bc) => bc.id === book.bookcaseId)?.name ?? 'Kitaplık'}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-emerald-900 tabular-nums">
                    {book.shelfRow}. Raf · Soldan {book.positionInShelf}. ({book.positionRegion})
                  </div>
                </div>

                {/* Reading status inline select */}
                <div className="pl-6 lg:pl-0">
                  <label htmlFor={`status-${book.id}`} className="sr-only">
                    {book.title} okuma durumu
                  </label>
                  <select
                    id={`status-${book.id}`}
                    value={book.readingStatus}
                    onChange={(e) =>
                      onQuickStatusChange(book.id, e.target.value as ReadingStatus)
                    }
                    className={`h-8 px-2.5 text-xs font-medium rounded-md border transition-colors focus:outline-none focus:border-emerald-800 ${
                      book.readingStatus === 'okundu'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : book.readingStatus === 'okunuyor'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <option value="okunacak">{READING_STATUS_LABELS.okunacak}</option>
                    <option value="okunuyor">{READING_STATUS_LABELS.okunuyor}</option>
                    <option value="okundu">{READING_STATUS_LABELS.okundu}</option>
                  </select>
                  {book.readingStatus === 'okunuyor' && book.pageCount && (
                    <div className="mt-1 text-[11px] font-mono text-zinc-500 tabular-nums">
                      %{pct} ({book.currentPage}/{book.pageCount})
                    </div>
                  )}
                </div>

                {/* Locate Action */}
                <div className="pl-6 lg:pl-0 flex lg:justify-end">
                  <button
                    type="button"
                    onClick={() => onLocateBook(book)}
                    aria-label={`${book.title} kitabını rafta göster`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-emerald-950 bg-zinc-100 hover:bg-emerald-900/10 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-800"
                  >
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Rafta Göster</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

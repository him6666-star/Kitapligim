import { useEffect, useMemo, useState } from 'react';
import { Camera, ScanBarcode } from 'lucide-react';
import type {
  ActiveTab,
  Book,
  Bookcase,
  CatalogFilters,
  ReadingStatus,
  SortOption,
} from './types/library';
import {
  applyReadingProgressUpdate,
  computeLibraryStats,
  filterAndSortBooks,
  matchesBookQuery,
} from './lib/libraryUtils';
import { loadLibrary, saveLibrary } from './lib/storage';
import { Header } from './components/Header';
import { BookLocatorBar } from './components/BookLocatorBar';
import { CatalogView } from './components/CatalogView';
import { ShelfMapView } from './components/ShelfMapView';
import { ReadingListView } from './components/ReadingListView';
import { DirectoryView } from './components/DirectoryView';
import { BookDetailDrawer } from './components/BookDetailDrawer';
import { ScannerModal, type ScannerMode } from './components/ScannerModal';

const DEFAULT_FILTERS: CatalogFilters = {
  query: '',
  category: '',
  author: '',
  publisher: '',
  bookcaseId: '',
  shelfRow: null,
  readingStatus: 'tumu',
  source: 'tumu',
};

export default function App() {
  const [library, setLibrary] = useState<{ books: Book[]; bookcases: Bookcase[] }>(() => {
    const loaded = loadLibrary();
    return { books: loaded.books, bookcases: loaded.bookcases };
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('katalog');
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('raf-sirasi');

  const [selectedBookcaseId, setSelectedBookcaseId] = useState<string>(
    () => library.bookcases[0]?.id ?? 'bc-salon'
  );
  const [highlightedBookId, setHighlightedBookId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('raf-fotografi');
  const [scannerBookcaseId, setScannerBookcaseId] = useState<string | undefined>(undefined);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    saveLibrary(library);
  }, [library]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(t);
  }, [notice]);

  const stats = useMemo(() => computeLibraryStats(library.books), [library.books]);

  const filteredBooks = useMemo(
    () => filterAndSortBooks(library.books, filters, sortBy),
    [library.books, filters, sortBy]
  );

  const quickLocatorMatches = useMemo(() => {
    if (!filters.query.trim()) return [];
    return library.books.filter((b) => matchesBookQuery(b, filters.query));
  }, [library.books, filters.query]);

  const selectedBook = useMemo(
    () => library.books.find((b) => b.id === selectedBookId) ?? null,
    [library.books, selectedBookId]
  );

  const categories = useMemo(() => stats.byCategory.map((e) => e.name), [stats.byCategory]);
  const authors = useMemo(() => stats.byAuthor.map((e) => e.name), [stats.byAuthor]);
  const publishers = useMemo(() => stats.byPublisher.map((e) => e.name), [stats.byPublisher]);

  function openScanner(mode: ScannerMode = 'raf-fotografi', bookcaseId?: string) {
    setScannerMode(mode);
    setScannerBookcaseId(bookcaseId);
    setScannerOpen(true);
  }

  function handleLocateBook(book: Book) {
    setSelectedBookId(null);
    setSelectedBookcaseId(book.bookcaseId);
    setHighlightedBookId(book.id);
    setActiveTab('raf-haritasi');
  }

  function handleUpdateBook(updated: Book) {
    setLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => (b.id === updated.id ? updated : b)),
    }));
  }

  function handleQuickStatusChange(bookId: string, status: ReadingStatus) {
    setLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          readingStatus: status,
          currentPage:
            status === 'okundu' && b.pageCount
              ? b.pageCount
              : status === 'okunacak'
              ? 0
              : b.currentPage,
          finishedAt: status === 'okundu' ? b.finishedAt ?? new Date().toISOString() : undefined,
        };
      }),
    }));
  }

  function handleUpdateProgress(bookId: string, nextPage: number) {
    setLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) =>
        b.id === bookId ? applyReadingProgressUpdate(b, nextPage) : b
      ),
    }));
  }

  function handleUpdateRating(bookId: string, rating: number) {
    setLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => (b.id === bookId ? { ...b, rating } : b)),
    }));
  }

  function handleDeleteBook(bookId: string) {
    setLibrary((prev) => ({
      ...prev,
      books: prev.books.filter((b) => b.id !== bookId),
    }));
    if (selectedBookId === bookId) setSelectedBookId(null);
    if (highlightedBookId === bookId) setHighlightedBookId(null);
    setNotice('Kitap kütüphaneden kaldırıldı.');
  }

  function handleAddBookcase(newBc: Omit<Bookcase, 'id'>) {
    const id = `bc-${Date.now()}`;
    setLibrary((prev) => ({
      ...prev,
      bookcases: [...prev.bookcases, { ...newBc, id }],
    }));
    setSelectedBookcaseId(id);
    setNotice(`“${newBc.name}” kitaplığı oluşturuldu.`);
  }

  function handleAddBooksBatch(
    newBooks: Array<Omit<Book, 'id' | 'addedAt'>>,
    shelfPhotoUpdate?: { bookcaseId: string; photoUrl: string }
  ) {
    const now = new Date().toISOString();
    const created: Book[] = newBooks.map((item, idx) => ({
      ...item,
      id: `book-${Date.now()}-${idx}`,
      addedAt: now,
    }));

    setLibrary((prev) => {
      const maxRowByBc = new Map<string, number>();
      for (const item of created) {
        const currentMax = maxRowByBc.get(item.bookcaseId) ?? 0;
        if (item.shelfRow > currentMax) maxRowByBc.set(item.bookcaseId, item.shelfRow);
      }

      const nextBookcases = prev.bookcases.map((bc) => {
        const neededRows = maxRowByBc.get(bc.id) ?? 0;
        const photoPatch =
          shelfPhotoUpdate && shelfPhotoUpdate.bookcaseId === bc.id
            ? { photoUrl: shelfPhotoUpdate.photoUrl, photoUpdatedAt: now }
            : {};
        return {
          ...bc,
          shelfCount: Math.max(bc.shelfCount, neededRows),
          ...photoPatch,
        };
      });

      return {
        books: [...created, ...prev.books],
        bookcases: nextBookcases,
      };
    });

    setNotice(
      created.length === 1
        ? `“${created[0].title}” kitaplığa eklendi.`
        : `${created.length} kitap raf konumlarıyla birlikte kitaplığa eklendi.`
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-900">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => openScanner('raf-fotografi')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Quiet feedback banner */}
        {notice && (
          <div
            role="status"
            className="bg-emerald-950 text-white text-xs sm:text-sm px-4 py-2.5 rounded-lg flex items-center justify-between"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-emerald-200 hover:text-white text-xs ml-4"
            >
              Kapat
            </button>
          </div>
        )}

        {/* Workspace Header + Instant Shelf Locator (visible on Katalog & Raf Haritası) */}
        {(activeTab === 'katalog' || activeTab === 'raf-haritasi') && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950 text-balance">
                  {activeTab === 'katalog'
                    ? 'Kişisel Kütüphane Kataloğu'
                    : 'Kitaplık Raf Haritası'}
                </h1>
                <p className="mt-1 text-sm text-zinc-500 flex items-center gap-2 flex-wrap tabular-nums">
                  <span>{stats.totalBooks} kitap</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.uniqueAuthors} yazar</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.uniquePublishers} yayınevi</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.readBooks} okundu</span>
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => openScanner('raf-fotografi')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-emerald-950 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Raf Fotoğrafı Tara</span>
                </button>
                <button
                  type="button"
                  onClick={() => openScanner('barkod')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:text-zinc-950 rounded-lg transition-colors whitespace-nowrap"
                >
                  <ScanBarcode className="w-4 h-4" aria-hidden="true" />
                  <span>Barkod Okut</span>
                </button>
              </div>
            </div>

            <BookLocatorBar
              query={filters.query}
              onQueryChange={(q) => {
                setFilters((prev) => ({ ...prev, query: q }));
                if (activeTab === 'raf-haritasi') setHighlightedBookId(null);
              }}
              quickMatches={quickLocatorMatches}
              bookcases={library.bookcases}
              onLocateBook={handleLocateBook}
              onSelectBook={(book) => setSelectedBookId(book.id)}
              totalCount={library.books.length}
              suppressDropdown={activeTab === 'raf-haritasi' && Boolean(highlightedBookId)}
            />
          </div>
        )}

        {/* Active View Content */}
        {activeTab === 'katalog' && (
          <CatalogView
            books={filteredBooks}
            allBooksCount={library.books.length}
            bookcases={library.bookcases}
            filters={filters}
            sortBy={sortBy}
            categories={categories}
            authors={authors}
            publishers={publishers}
            onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            onSortChange={setSortBy}
            onSelectBook={(book) => setSelectedBookId(book.id)}
            onLocateBook={handleLocateBook}
            onQuickStatusChange={handleQuickStatusChange}
            onOpenScanner={(mode) => openScanner(mode ?? 'raf-fotografi')}
          />
        )}

        {activeTab === 'raf-haritasi' && (
          <ShelfMapView
            books={library.books}
            bookcases={library.bookcases}
            selectedBookcaseId={selectedBookcaseId}
            highlightedBookId={highlightedBookId}
            onSelectBookcase={(id) => {
              setSelectedBookcaseId(id);
              setHighlightedBookId(null);
            }}
            onClearHighlight={() => setHighlightedBookId(null)}
            onSelectBook={(book) => setSelectedBookId(book.id)}
            onAddBookcase={handleAddBookcase}
            onScanShelfForBookcase={(bcId) => openScanner('raf-fotografi', bcId)}
          />
        )}

        {activeTab === 'okuma-listesi' && (
          <div className="space-y-5">
            <div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
                Okuma Listesi
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Okuduğunuz kitapların sayfa ilerlemesini, puanlarını ve notlarını buradan takip
                edin.
              </p>
            </div>
            <ReadingListView
              books={library.books}
              bookcases={library.bookcases}
              stats={stats}
              onUpdateProgress={handleUpdateProgress}
              onUpdateStatus={handleQuickStatusChange}
              onUpdateRating={handleUpdateRating}
              onSelectBook={(book) => setSelectedBookId(book.id)}
              onLocateBook={handleLocateBook}
            />
          </div>
        )}

        {activeTab === 'dizin' && (
          <DirectoryView
            byPublisher={stats.byPublisher}
            byAuthor={stats.byAuthor}
            byCategory={stats.byCategory}
            onFilterByPublisher={(publisher) => {
              setFilters({ ...DEFAULT_FILTERS, publisher });
              setActiveTab('katalog');
            }}
            onFilterByAuthor={(author) => {
              setFilters({ ...DEFAULT_FILTERS, author });
              setActiveTab('katalog');
            }}
            onFilterByCategory={(category) => {
              setFilters({ ...DEFAULT_FILTERS, category });
              setActiveTab('katalog');
            }}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <span>Rafİzi — Kişisel Kitaplık Kataloğu ve Raf Bulucu</span>
          <span className="tabular-nums">
            {library.bookcases.length} kitaplık · {library.books.length} kayıtlı kitap
          </span>
        </div>
      </footer>

      <BookDetailDrawer
        book={selectedBook}
        bookcases={library.bookcases}
        onClose={() => setSelectedBookId(null)}
        onUpdateBook={handleUpdateBook}
        onDeleteBook={handleDeleteBook}
        onLocateBook={handleLocateBook}
      />

      <ScannerModal
        open={scannerOpen}
        initialMode={scannerMode}
        initialBookcaseId={scannerBookcaseId}
        bookcases={library.bookcases}
        existingBooks={library.books}
        onClose={() => setScannerOpen(false)}
        onAddBooksBatch={handleAddBooksBatch}
      />
    </div>
  );
}

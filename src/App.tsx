import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Camera, Cloud, Download, ScanBarcode } from 'lucide-react';
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
import {
  addBooksBatchInCloud,
  createBookcaseInCloud,
  deleteBookInCloud,
  ensureUserProfile,
  importLibraryToCloud,
  seedSampleLibraryInCloud,
  subscribeUserLibrary,
  updateBookInCloud,
  updateBookReadingStateInCloud,
} from './lib/firestoreLibrary';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { SignInView, GoogleLogo } from './components/SignInView';
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
  const { user, authReady, signingIn, authError, signInWithGoogle, signOutUser } = useAuth();

  // Signed-out local demo preview state
  const [previewMode, setPreviewMode] = useState(false);
  const [localLibrary, setLocalLibrary] = useState<{ books: Book[]; bookcases: Bookcase[] }>(() => {
    const loaded = loadLibrary();
    return { books: loaded.books, bookcases: loaded.bookcases };
  });

  // Cloud Firestore library state for signed-in user
  const [cloudLibrary, setCloudLibrary] = useState<{ books: Book[]; bookcases: Bookcase[] }>({
    books: [],
    bookcases: [],
  });
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('katalog');
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('raf-sirasi');

  const [selectedBookcaseId, setSelectedBookcaseId] = useState<string>('bc-salon');
  const [highlightedBookId, setHighlightedBookId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('raf-fotografi');
  const [scannerBookcaseId, setScannerBookcaseId] = useState<string | undefined>(undefined);

  const [notice, setNotice] = useState<string | null>(null);

  // Throw fatal Firestore listener errors to the top-level ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  // Persist local preview library when not signed in
  useEffect(() => {
    if (!user && previewMode) {
      saveLibrary(localLibrary);
    }
  }, [localLibrary, user, previewMode]);

  // Subscribe to authenticated user's private Firestore library
  useEffect(() => {
    if (!authReady || !user) {
      setCloudLibrary({ books: [], bookcases: [] });
      setCloudLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let gotBookcases = false;
    let gotBooks = false;

    setCloudLoading(true);
    setSelectedBookId(null);
    setHighlightedBookId(null);

    void (async () => {
      try {
        await ensureUserProfile(user);
        if (cancelled) return;

        unsubscribe = subscribeUserLibrary(user.uid, {
          onBookcases: (bookcases) => {
            gotBookcases = true;
            setCloudLibrary((prev) => ({ ...prev, bookcases }));
            if (gotBookcases && gotBooks) setCloudLoading(false);
          },
          onBooks: (books) => {
            gotBooks = true;
            setCloudLibrary((prev) => ({ ...prev, books }));
            if (gotBookcases && gotBooks) setCloudLoading(false);
          },
          onError: (err) => {
            setCloudLoading(false);
            setFatalError(err);
          },
        });
      } catch (err) {
        if (!cancelled) {
          setCloudLoading(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [authReady, user]);

  const library = user ? cloudLibrary : localLibrary;

  // Keep selectedBookcaseId valid whenever bookcases change
  useEffect(() => {
    if (library.bookcases.length === 0) return;
    const stillExists = library.bookcases.some((bc) => bc.id === selectedBookcaseId);
    if (!stillExists) {
      setSelectedBookcaseId(library.bookcases[0].id);
    }
  }, [library.bookcases, selectedBookcaseId]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
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

  const hasLocalSavedBooks = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('rafizi_library_v1');
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { books?: unknown[] };
      return Array.isArray(parsed.books) && parsed.books.length > 0;
    } catch {
      return false;
    }
  }, [user]);

  async function openScanner(mode: ScannerMode = 'raf-fotografi', bookcaseId?: string) {
    let targetBookcaseId = bookcaseId;

    // Ensure a signed-in user with an empty cloud library has at least one bookcase before scanning
    if (user && cloudLibrary.bookcases.length === 0) {
      try {
        setCloudBusy(true);
        const created = await createBookcaseInCloud(user.uid, {
          name: 'Ana Kitaplık',
          room: 'Salon',
          shelfCount: 4,
        });
        targetBookcaseId = created.id;
        setSelectedBookcaseId(created.id);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
        return;
      } finally {
        setCloudBusy(false);
      }
    }

    setScannerMode(mode);
    setScannerBookcaseId(targetBookcaseId);
    setScannerOpen(true);
  }

  function handleLocateBook(book: Book) {
    setSelectedBookId(null);
    setSelectedBookcaseId(book.bookcaseId);
    setHighlightedBookId(book.id);
    setActiveTab('raf-haritasi');
  }

  function handleUpdateBook(updated: Book) {
    if (user) {
      void updateBookInCloud(user.uid, updated).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
      return;
    }
    setLocalLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => (b.id === updated.id ? updated : b)),
    }));
  }

  function handleQuickStatusChange(bookId: string, status: ReadingStatus) {
    const existing = library.books.find((b) => b.id === bookId);
    if (!existing) return;

    const nextPage =
      status === 'okundu' && existing.pageCount
        ? existing.pageCount
        : status === 'okunacak'
        ? 0
        : existing.currentPage;
    const nextFinishedAt =
      status === 'okundu' ? existing.finishedAt ?? new Date().toISOString() : null;

    if (user) {
      void updateBookReadingStateInCloud(user.uid, bookId, {
        readingStatus: status,
        currentPage: nextPage,
        finishedAt: nextFinishedAt,
      }).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
      return;
    }

    setLocalLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          readingStatus: status,
          currentPage: nextPage,
          finishedAt: nextFinishedAt ?? undefined,
        };
      }),
    }));
  }

  function handleUpdateProgress(bookId: string, nextPage: number) {
    const existing = library.books.find((b) => b.id === bookId);
    if (!existing) return;
    const updated = applyReadingProgressUpdate(existing, nextPage);

    if (user) {
      void updateBookReadingStateInCloud(user.uid, bookId, {
        readingStatus: updated.readingStatus,
        currentPage: updated.currentPage,
        finishedAt: updated.finishedAt ?? null,
      }).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
      return;
    }

    setLocalLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  }

  function handleUpdateRating(bookId: string, rating: number) {
    if (user) {
      void updateBookReadingStateInCloud(user.uid, bookId, { rating }).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
      return;
    }
    setLocalLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => (b.id === bookId ? { ...b, rating } : b)),
    }));
  }

  function handleDeleteBook(bookId: string) {
    if (selectedBookId === bookId) setSelectedBookId(null);
    if (highlightedBookId === bookId) setHighlightedBookId(null);

    if (user) {
      void deleteBookInCloud(user.uid, bookId)
        .then(() => setNotice('Kitap hesabınızdan kaldırıldı.'))
        .catch((err) => {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    setLocalLibrary((prev) => ({
      ...prev,
      books: prev.books.filter((b) => b.id !== bookId),
    }));
    setNotice('Kitap kütüphaneden kaldırıldı.');
  }

  function handleAddBookcase(newBc: Omit<Bookcase, 'id'>) {
    if (user) {
      void createBookcaseInCloud(user.uid, newBc)
        .then((created) => {
          setSelectedBookcaseId(created.id);
          setNotice(`“${created.name}” kitaplığı hesabınıza kaydedildi.`);
        })
        .catch((err) => {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    const id = `bc-${Date.now()}`;
    setLocalLibrary((prev) => ({
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
    if (user) {
      void addBooksBatchInCloud(user.uid, newBooks, cloudLibrary.bookcases, shelfPhotoUpdate)
        .then((created) => {
          setNotice(
            created.length === 1
              ? `“${created[0].title}” Google hesabınıza kaydedildi.`
              : `${created.length} kitap raf konumlarıyla Google hesabınıza kaydedildi.`
          );
        })
        .catch((err) => {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    const now = new Date().toISOString();
    const created: Book[] = newBooks.map((item, idx) => ({
      ...item,
      id: `book-${Date.now()}-${idx}`,
      addedAt: now,
    }));

    setLocalLibrary((prev) => {
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

  async function handleSeedSampleCloud() {
    if (!user) return;
    setCloudBusy(true);
    try {
      await seedSampleLibraryInCloud(user);
      setNotice('20 kitaplık örnek kütüphane Google hesabınıza yüklendi.');
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleImportLocalToCloud() {
    if (!user) return;
    setCloudBusy(true);
    try {
      const loaded = loadLibrary();
      await importLibraryToCloud(user, {
        bookcases: loaded.bookcases,
        books: loaded.books,
      });
      setNotice(`${loaded.books.length} yerel kitap Google hesabınıza aktarıldı.`);
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleSignOut() {
    setPreviewMode(false);
    setFilters(DEFAULT_FILTERS);
    setSelectedBookId(null);
    setHighlightedBookId(null);
    await signOutUser();
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-editorial text-2xl font-semibold text-zinc-900">Rafİzi</p>
          <p className="text-sm text-zinc-500">Hesap durumu kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (!user && !previewMode) {
    return (
      <SignInView
        signingIn={signingIn}
        authError={authError}
        onSignInWithGoogle={() => void signInWithGoogle()}
        onEnterPreview={() => setPreviewMode(true)}
      />
    );
  }

  const isCloudEmpty = Boolean(user && !cloudLoading && cloudLibrary.books.length === 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-900">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScanner={() => void openScanner('raf-fotografi')}
        user={user}
        signingIn={signingIn}
        onSignInWithGoogle={() => void signInWithGoogle()}
        onSignOut={() => void handleSignOut()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Auth error banner (if popup sign-in failed while in preview mode) */}
        {authError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm px-4 py-2.5 rounded-lg"
          >
            {authError}
          </div>
        )}

        {/* Preview mode notice encouraging Google Sign-In */}
        {!user && previewMode && (
          <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-zinc-700">
              <Cloud className="w-4 h-4 text-emerald-900 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <span>
                Örnek kitaplığı yerel önizleme modunda inceliyorsunuz. Kendi kitaplığınızı ve
                okuma listenizi saklamak için Google ile giriş yapın.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={signingIn}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
                <GoogleLogo className="w-3 h-3" />
              </span>
              <span>{signingIn ? 'Bağlanıyor...' : 'Google ile Giriş Yap'}</span>
            </button>
          </div>
        )}

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

        {/* Initial cloud sync skeleton */}
        {user && cloudLoading ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center space-y-2">
            <p className="font-editorial text-xl text-zinc-900">Bulut kitaplığınız yükleniyor...</p>
            <p className="text-sm text-zinc-500">
              {user.displayName ? `${user.displayName} hesabındaki` : 'Hesabınızdaki'} kitaplar ve
              okuma listesi senkronize ediliyor.
            </p>
          </div>
        ) : isCloudEmpty && activeTab === 'katalog' ? (
          /* Clean first-time onboarding for newly signed-in Google accounts */
          <section className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10 space-y-6">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-900 font-medium">
                Kişisel Bulut Kitaplığı
              </p>
              <h1 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
                Hoş geldiniz{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}. Kitaplığınız hazır.
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                Eklediğiniz her kitap, raf fotoğrafı konumu ve okuma listeniz yalnızca sizin Google
                hesabınızda saklanır. Başlamak için bir raf fotoğrafı tarayın, barkod okutun veya
                örnek kütüphaneyi yükleyin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={cloudBusy}
                onClick={() => void openScanner('raf-fotografi')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-60"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Raf Fotoğrafı Tara</span>
              </button>
              <button
                type="button"
                disabled={cloudBusy}
                onClick={() => void openScanner('barkod')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-800 bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg transition-colors disabled:opacity-60"
              >
                <ScanBarcode className="w-4 h-4" aria-hidden="true" />
                <span>Barkod Okut</span>
              </button>
              <button
                type="button"
                disabled={cloudBusy}
                onClick={() => void handleSeedSampleCloud()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-950 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors disabled:opacity-60"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>{cloudBusy ? 'Yükleniyor...' : 'Örnek Kitaplık Yükle (20 Kitap)'}</span>
              </button>
              {hasLocalSavedBooks && (
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={() => void handleImportLocalToCloud()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Bu Cihazdaki Kitapları Aktar</span>
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
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
                      onClick={() => void openScanner('raf-fotografi')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-emerald-950 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Camera className="w-4 h-4" aria-hidden="true" />
                      <span>Raf Fotoğrafı Tara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void openScanner('barkod')}
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
                onOpenScanner={(mode) => void openScanner(mode ?? 'raf-fotografi')}
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
                onScanShelfForBookcase={(bcId) => void openScanner('raf-fotografi', bcId)}
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
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            Rafİzi — Kişisel Kitaplık Kataloğu ve Raf Bulucu
            {user ? ' · Google Bulut Senkronizasyonu Aktif' : ' · Yerel Önizleme'}
          </span>
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

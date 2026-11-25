import { useState } from 'react';
import { Camera, Image as ImageIcon, Layers, MapPin, Plus, X } from 'lucide-react';
import type { Book, Bookcase } from '../types/library';
import {
  formatShelfLocation,
  groupBooksByShelf,
  isLightHexColor,
} from '../lib/libraryUtils';

interface ShelfMapViewProps {
  books: Book[];
  bookcases: Bookcase[];
  selectedBookcaseId: string;
  highlightedBookId: string | null;
  onSelectBookcase: (id: string) => void;
  onClearHighlight: () => void;
  onSelectBook: (book: Book) => void;
  onAddBookcase: (bookcase: Omit<Bookcase, 'id'>) => void;
  onScanShelfForBookcase: (bookcaseId: string) => void;
}

export function ShelfMapView({
  books,
  bookcases,
  selectedBookcaseId,
  highlightedBookId,
  onSelectBookcase,
  onClearHighlight,
  onSelectBook,
  onAddBookcase,
  onScanShelfForBookcase,
}: ShelfMapViewProps) {
  const activeBookcase =
    bookcases.find((bc) => bc.id === selectedBookcaseId) ?? bookcases[0];

  const [displayMode, setDisplayMode] = useState<'diyagram' | 'fotograf'>('diyagram');
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [newShelves, setNewShelves] = useState(4);
  const [formError, setFormError] = useState('');

  if (!activeBookcase) return null;

  const bookcaseBooks = books.filter((b) => b.bookcaseId === activeBookcase.id);
  const shelfRows = groupBooksByShelf(books, activeBookcase.id, activeBookcase.shelfCount);
  const highlightedBook = highlightedBookId
    ? books.find((b) => b.id === highlightedBookId) ?? null
    : null;

  const booksWithBox = bookcaseBooks.filter((b) => Boolean(b.box2d));
  const inspectedId = hoveredBookId || highlightedBookId;
  const inspectedBook = inspectedId
    ? bookcaseBooks.find((b) => b.id === inspectedId) ?? null
    : null;

  function handleCreateBookcase(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFormError('Lütfen kitaplık için bir ad girin.');
      return;
    }
    setFormError('');
    onAddBookcase({
      name: trimmed,
      room: newRoom.trim() || 'Ev',
      shelfCount: Math.max(1, Math.min(12, Number(newShelves) || 3)),
    });
    setNewName('');
    setNewRoom('');
    setNewShelves(4);
    setShowNewForm(false);
  }

  return (
    <div className="space-y-6">
      {/* Located book callout banner when navigating from Search / Rafta Göster */}
      {highlightedBook && (
        <div
          data-testid="shelf-locator-banner"
          className="bg-emerald-950 text-white rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-xs text-emerald-200 font-medium">Seçili Kitabın Raf Konumu</p>
            <h3 className="font-editorial text-lg font-medium mt-0.5 text-white">
              {highlightedBook.title}{' '}
              <span className="font-sans text-sm font-normal text-emerald-200">
                — {highlightedBook.author}
              </span>
            </h3>
            <p className="mt-1 font-mono text-xs sm:text-sm text-amber-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{formatShelfLocation(highlightedBook, bookcases)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeBookcase.photoUrl && highlightedBook.box2d && displayMode !== 'fotograf' && (
              <button
                type="button"
                onClick={() => setDisplayMode('fotograf')}
                className="px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                Fotoğrafta Gör
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectBook(highlightedBook)}
              className="px-3 py-1.5 text-xs font-medium bg-white text-emerald-950 hover:bg-emerald-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Detaylar
            </button>
            <button
              type="button"
              onClick={onClearHighlight}
              aria-label="Konum vurgusunu kapat"
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Bookcase selector + Display mode toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {bookcases.map((bc) => {
            const count = books.filter((b) => b.bookcaseId === bc.id).length;
            const isSelected = bc.id === activeBookcase.id;
            return (
              <button
                key={bc.id}
                type="button"
                onClick={() => onSelectBookcase(bc.id)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:text-zinc-950'
                }`}
              >
                {bc.name}{' '}
                <span
                  className={`ml-1 font-mono text-xs tabular-nums ${
                    isSelected ? 'text-zinc-300' : 'text-zinc-400'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Kitaplık Ekle</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="group"
            aria-label="Raf görünüm modu"
            className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setDisplayMode('diyagram')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                displayMode === 'diyagram'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Raf Diyagramı</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('fotograf')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                displayMode === 'fotograf'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Kitaplık Fotoğrafı</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onScanShelfForBookcase(activeBookcase.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-900 bg-emerald-900/10 hover:bg-emerald-900/15 rounded-lg transition-colors whitespace-nowrap"
          >
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Bu Kitaplığı Tara</span>
          </button>
        </div>
      </div>

      {/* Inline Add New Bookcase Form */}
      {showNewForm && (
        <form
          onSubmit={handleCreateBookcase}
          className="bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label htmlFor="new-bc-name" className="block text-xs font-medium text-zinc-700 mb-1">
              Kitaplık Adı
            </label>
            <input
              id="new-bc-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Örn. Koridor Kitaplığı"
              className="w-full h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
            />
          </div>
          <div>
            <label htmlFor="new-bc-room" className="block text-xs font-medium text-zinc-700 mb-1">
              Oda / Konum
            </label>
            <input
              id="new-bc-room"
              type="text"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="Örn. Yatak Odası"
              className="w-full h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
            />
          </div>
          <div>
            <label htmlFor="new-bc-shelves" className="block text-xs font-medium text-zinc-700 mb-1">
              Raf Sayısı
            </label>
            <input
              id="new-bc-shelves"
              type="number"
              min={1}
              max={12}
              value={newShelves}
              onChange={(e) => setNewShelves(Number(e.target.value))}
              className="w-full h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="h-9 px-4 text-xs font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
            >
              Oluştur
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setFormError('');
              }}
              className="h-9 px-3 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              İptal
            </button>
          </div>
          {formError && (
            <p className="sm:col-span-4 text-xs text-red-700" role="alert">
              {formError}
            </p>
          )}
        </form>
      )}

      {/* Mode 1: Interactive Visual Spine Shelf Diagram */}
      {displayMode === 'diyagram' ? (
        <div
          data-testid="shelf-diagram"
          className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 space-y-6"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-3">
            <div>
              <h2 className="font-editorial text-xl font-medium text-zinc-950">
                {activeBookcase.name}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {activeBookcase.room} · {shelfRows.length} raf ·{' '}
                <span className="tabular-nums">{bookcaseBooks.length}</span> kitap kayıtlı
              </p>
            </div>
            <span className="text-xs text-zinc-500 hidden sm:inline">
              Detay görmek için herhangi bir kitap sırtına tıklayın
            </span>
          </div>

          <div className="space-y-5">
            {shelfRows.map((row) => (
              <div key={row.shelfRow} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono font-medium text-zinc-700 tabular-nums">
                    {row.shelfRow}. Raf
                  </span>
                  <span className="tabular-nums">{row.books.length} kitap</span>
                </div>

                {/* Bookcase wooden/architectural shelf compartment */}
                <div className="bg-zinc-100/80 border border-zinc-200 rounded-lg px-4 pt-9 pb-0 overflow-x-auto">
                  {row.books.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-zinc-400 pb-4">
                      Bu rafta henüz kayıtlı kitap yok
                    </div>
                  ) : (
                    <div className="flex items-end gap-1.5 min-h-[176px] pb-2">
                      {row.books.map((book) => {
                        const isHighlighted = highlightedBookId === book.id;
                        const lightBg = isLightHexColor(book.spineColor);
                        // Vary book height slightly by page count for natural silhouette
                        const pages = book.pageCount ?? 300;
                        const heightPx = Math.max(134, Math.min(176, 130 + Math.round(pages / 14)));
                        const widthPx = Math.max(38, Math.min(58, 36 + Math.round(pages / 32)));

                        return (
                          <button
                            key={book.id}
                            type="button"
                            onClick={() => onSelectBook(book)}
                            onMouseEnter={() => setHoveredBookId(book.id)}
                            onMouseLeave={() => setHoveredBookId(null)}
                            aria-label={`${book.title} — ${book.author} (${row.shelfRow}. Raf, ${book.positionInShelf}. sıra)`}
                            style={{
                              backgroundColor: book.spineColor,
                              height: `${heightPx}px`,
                              width: `${widthPx}px`,
                            }}
                            className={`relative rounded-t-[3px] shrink-0 flex flex-col items-center justify-between py-2.5 px-1 transition-transform duration-150 hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${
                              lightBg
                                ? 'text-zinc-900 border border-zinc-300/90'
                                : 'text-zinc-50 border border-black/15'
                            } ${
                              isHighlighted
                                ? 'ring-3 ring-amber-500 ring-offset-2 -translate-y-2 z-10'
                                : ''
                            }`}
                          >
                            {isHighlighted && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                              >
                                BURADA
                              </span>
                            )}
                            <span className="font-mono text-[9px] opacity-70 tabular-nums leading-none">
                              {book.positionInShelf}
                            </span>
                            <span className="spine-text text-[11px] font-medium leading-tight truncate max-h-[112px] tracking-tight">
                              {book.title}
                            </span>
                            <span className="w-2/3 h-[1px] bg-current opacity-25" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Clean architectural shelf plank */}
                  <div
                    aria-hidden="true"
                    className="-mx-4 h-2.5 bg-zinc-300/80 border-t border-zinc-300 rounded-b-lg"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quiet live preview footer bar for hovered/focused book */}
          <div className="pt-2 border-t border-zinc-100 min-h-[28px] flex items-center justify-between text-xs text-zinc-600">
            {inspectedBook ? (
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-zinc-950 font-semibold">{inspectedBook.title}</strong>
                <span>·</span>
                <span>{inspectedBook.author}</span>
                <span>·</span>
                <span>{inspectedBook.publisher}</span>
                <span>·</span>
                <span className="font-mono text-emerald-900">
                  {inspectedBook.shelfRow}. Raf, Soldan {inspectedBook.positionInShelf}. sıra ({inspectedBook.positionRegion})
                </span>
              </div>
            ) : (
              <span className="text-zinc-400">
                Raf üzerindeki kitapların üzerine gelerek sırt bilgilerini hızlıca görebilirsiniz.
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Mode 2: Real Photographed Shelf Pin-Map */
        <div
          data-testid="shelf-photo-map"
          className="bg-white border border-zinc-200 rounded-xl overflow-hidden"
        >
          {activeBookcase.photoUrl ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
              <div className="relative bg-zinc-950">
                <img
                  src={activeBookcase.photoUrl}
                  alt={`${activeBookcase.name} raf fotoğrafı`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover block select-none"
                />
                {/* Interactive bounding box pins over detected book spines */}
                <div className="absolute inset-0">
                  {booksWithBox.map((book) => {
                    if (!book.box2d) return null;
                    const [ymin, xmin, ymax, xmax] = book.box2d;
                    const isHighlighted = highlightedBookId === book.id;
                    const isHovered = hoveredBookId === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => onSelectBook(book)}
                        onMouseEnter={() => setHoveredBookId(book.id)}
                        onMouseLeave={() => setHoveredBookId(null)}
                        aria-label={`${book.title} (${book.shelfRow}. Raf, ${book.positionInShelf}. sıra)`}
                        style={{
                          top: `${ymin / 10}%`,
                          left: `${xmin / 10}%`,
                          height: `${Math.max(4, (ymax - ymin) / 10)}%`,
                          width: `${Math.max(2.4, (xmax - xmin) / 10)}%`,
                        }}
                        className={`absolute rounded-[3px] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          isHighlighted
                            ? 'border-2 border-amber-400 bg-amber-400/25 shadow-[0_0_0_2px_rgba(0,0,0,0.6)] z-20'
                            : isHovered
                            ? 'border-2 border-white bg-white/20 z-10'
                            : 'border border-white/45 bg-black/10 hover:bg-white/15'
                        }`}
                      >
                        {(isHighlighted || isHovered) && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-950/90 text-white text-[11px] font-medium whitespace-nowrap pointer-events-none shadow-sm">
                            {book.title}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Side index of books mapped on this photo */}
              <div className="border-t lg:border-t-0 lg:border-l border-zinc-200 p-4 flex flex-col max-h-[540px]">
                <div className="pb-3 border-b border-zinc-100">
                  <h3 className="font-editorial text-base font-medium text-zinc-950">
                    Fotoğraftaki Kitaplar
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                    {booksWithBox.length} kitap konumu fotoğraf üzerinde işaretli
                  </p>
                </div>
                <div className="overflow-y-auto divide-y divide-zinc-100 flex-1 mt-1">
                  {bookcaseBooks.map((book) => {
                    const active = highlightedBookId === book.id || hoveredBookId === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => onSelectBook(book)}
                        onMouseEnter={() => setHoveredBookId(book.id)}
                        onMouseLeave={() => setHoveredBookId(null)}
                        className={`w-full text-left py-2.5 px-2 rounded-md transition-colors ${
                          active ? 'bg-amber-50' : 'hover:bg-zinc-50'
                        }`}
                      >
                        <div className="text-xs font-medium text-zinc-950 truncate">
                          {book.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate">{book.author}</span>
                          <span className="font-mono tabular-nums text-emerald-900 shrink-0">
                            {book.shelfRow}. Raf · #{book.positionInShelf}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <h3 className="font-editorial text-lg font-medium text-zinc-900">
                Bu kitaplık için henüz fotoğraf taranmadı
              </h3>
              <p className="mt-1.5 text-sm text-zinc-500 max-w-md mx-auto">
                Kitaplığınızın fotoğrafını çektiğinizde her kitabın tam konumu fotoğraf üzerinde
                işaretlenir.
              </p>
              <button
                type="button"
                onClick={() => onScanShelfForBookcase(activeBookcase.id)}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Kitaplık Fotoğrafı Tara</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

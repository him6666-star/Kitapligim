import { useEffect, useState } from 'react';
import { MapPin, Pencil, Star, Trash2, X } from 'lucide-react';
import type { Book, Bookcase, ReadingStatus, ShelfRegion } from '../types/library';
import {
  BOOK_CATEGORIES,
  READING_STATUS_LABELS,
  SOURCE_LABELS,
} from '../types/library';
import {
  calculateReadingProgress,
  formatShelfLocation,
  isLightHexColor,
} from '../lib/libraryUtils';

interface BookDetailDrawerProps {
  book: Book | null;
  bookcases: Bookcase[];
  onClose: () => void;
  onUpdateBook: (updated: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onLocateBook: (book: Book) => void;
}

export function BookDetailDrawer({
  book,
  bookcases,
  onClose,
  onUpdateBook,
  onDeleteBook,
  onLocateBook,
}: BookDetailDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Book | null>(book);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    setDraft(book);
    setEditing(false);
    setConfirmDelete(false);
    setEditError('');
  }, [book]);

  useEffect(() => {
    if (!book) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [book, onClose]);

  if (!book || !draft) return null;

  const bookcase = bookcases.find((bc) => bc.id === book.bookcaseId);
  const pct = calculateReadingProgress(book.currentPage, book.pageCount);
  const lightSpine = isLightHexColor(book.spineColor);

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) {
      setEditError('Kitap adı boş bırakılamaz.');
      return;
    }
    if (!draft.author.trim()) {
      setEditError('Yazar adı boş bırakılamaz.');
      return;
    }
    setEditError('');
    onUpdateBook({
      ...draft,
      title: draft.title.trim(),
      author: draft.author.trim(),
      publisher: draft.publisher.trim() || 'Bilinmiyor',
      shelfRow: Math.max(1, Number(draft.shelfRow) || 1),
      positionInShelf: Math.max(1, Number(draft.positionInShelf) || 1),
    });
    setEditing(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title} kitap detayları`}
        className="w-full max-w-lg bg-white h-full overflow-y-auto border-l border-zinc-200 flex flex-col"
      >
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs border-b border-zinc-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className={`w-3 h-7 rounded-[2px] shrink-0 ${
                lightSpine ? 'border border-zinc-300' : ''
              }`}
              style={{ backgroundColor: book.spineColor }}
            />
            <span className="text-xs font-medium text-zinc-500 truncate">
              {SOURCE_LABELS[book.source]} · {book.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Kitap bilgilerini düzenle"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-md"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Düzenle</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Detay panelini kapat"
              className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1">
          {editing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label htmlFor="edit-title" className="block text-xs font-medium text-zinc-700 mb-1">
                  Kitap Adı *
                </label>
                <input
                  id="edit-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-author" className="block text-xs font-medium text-zinc-700 mb-1">
                    Yazar *
                  </label>
                  <input
                    id="edit-author"
                    type="text"
                    value={draft.author}
                    onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                  />
                </div>
                <div>
                  <label htmlFor="edit-publisher" className="block text-xs font-medium text-zinc-700 mb-1">
                    Yayınevi
                  </label>
                  <input
                    id="edit-publisher"
                    type="text"
                    value={draft.publisher}
                    onChange={(e) => setDraft({ ...draft, publisher: e.target.value })}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-category" className="block text-xs font-medium text-zinc-700 mb-1">
                    Kategori
                  </label>
                  <select
                    id="edit-category"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
                  >
                    {BOOK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-isbn" className="block text-xs font-medium text-zinc-700 mb-1">
                    ISBN
                  </label>
                  <input
                    id="edit-isbn"
                    type="text"
                    value={draft.isbn ?? ''}
                    onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-pages" className="block text-xs font-medium text-zinc-700 mb-1">
                    Sayfa Sayısı
                  </label>
                  <input
                    id="edit-pages"
                    type="number"
                    min={1}
                    value={draft.pageCount ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        pageCount: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-800"
                  />
                </div>
                <div>
                  <label htmlFor="edit-year" className="block text-xs font-medium text-zinc-700 mb-1">
                    Basım Yılı
                  </label>
                  <input
                    id="edit-year"
                    type="number"
                    value={draft.publishYear ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        publishYear: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 space-y-3">
                <div className="text-xs font-medium text-zinc-700">Raf Konumu</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label htmlFor="edit-bookcase" className="block text-xs text-zinc-500 mb-1">
                      Kitaplık
                    </label>
                    <select
                      id="edit-bookcase"
                      value={draft.bookcaseId}
                      onChange={(e) => setDraft({ ...draft, bookcaseId: e.target.value })}
                      className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                    >
                      {bookcases.map((bc) => (
                        <option key={bc.id} value={bc.id}>
                          {bc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-shelf-row" className="block text-xs text-zinc-500 mb-1">
                      Raf No
                    </label>
                    <input
                      id="edit-shelf-row"
                      type="number"
                      min={1}
                      value={draft.shelfRow}
                      onChange={(e) =>
                        setDraft({ ...draft, shelfRow: Number(e.target.value) || 1 })
                      }
                      className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-pos" className="block text-xs text-zinc-500 mb-1">
                      Soldan Sıra
                    </label>
                    <input
                      id="edit-pos"
                      type="number"
                      min={1}
                      value={draft.positionInShelf}
                      onChange={(e) =>
                        setDraft({ ...draft, positionInShelf: Number(e.target.value) || 1 })
                      }
                      className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-region" className="block text-xs text-zinc-500 mb-1">
                      Bölge
                    </label>
                    <select
                      id="edit-region"
                      value={draft.positionRegion}
                      onChange={(e) =>
                        setDraft({ ...draft, positionRegion: e.target.value as ShelfRegion })
                      }
                      className="w-full h-10 px-3 bg-zinc-50 border border-zinc-300 rounded-lg text-sm"
                    >
                      <option value="Sol">Sol</option>
                      <option value="Orta">Orta</option>
                      <option value="Sağ">Sağ</option>
                    </select>
                  </div>
                </div>
              </div>

              {editError && (
                <p role="alert" className="text-xs text-red-700 font-medium">
                  {editError}
                </p>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg"
                >
                  Değişiklikleri Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(book);
                    setEditing(false);
                    setEditError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                >
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Title Header */}
              <div>
                <h2 className="font-editorial text-2xl font-medium text-zinc-950 leading-snug">
                  {book.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {book.author} · {book.publisher}
                </p>
              </div>

              {/* Physical Location Card */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-500">Kitaplıktaki Konumu</div>
                    <div className="mt-1 font-mono text-sm font-medium text-emerald-950 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-800 shrink-0" aria-hidden="true" />
                      <span>{formatShelfLocation(book, bookcases)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLocateBook(book)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Rafta Göster
                  </button>
                </div>

                {/* Shelf Photo Mini Preview with Highlighted Box if Available */}
                {bookcase?.photoUrl && book.box2d && (
                  <div className="relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-900 aspect-[16/9]">
                    <img
                      src={bookcase.photoUrl}
                      alt={`${bookcase.name} içinde ${book.title} konumu`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-85"
                    />
                    <div
                      aria-hidden="true"
                      style={{
                        top: `${book.box2d[0] / 10}%`,
                        left: `${book.box2d[1] / 10}%`,
                        height: `${Math.max(4, (book.box2d[2] - book.box2d[0]) / 10)}%`,
                        width: `${Math.max(2.5, (book.box2d[3] - book.box2d[1]) / 10)}%`,
                      }}
                      className="absolute border-2 border-amber-400 bg-amber-400/25 shadow-[0_0_0_2px_rgba(0,0,0,0.65)] rounded-[2px]"
                    />
                  </div>
                )}
              </div>

              {/* Bibliographic Accession Definition List */}
              <dl className="divide-y divide-zinc-100 border-t border-b border-zinc-200 text-sm">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">Yazar</dt>
                  <dd className="text-zinc-950 font-medium text-right">{book.author}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">Yayınevi</dt>
                  <dd className="text-zinc-950 font-medium text-right">{book.publisher}</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-zinc-500">Kategori</dt>
                  <dd className="text-zinc-950 text-right">{book.category}</dd>
                </div>
                {book.isbn && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-zinc-500">ISBN</dt>
                    <dd className="font-mono text-zinc-900 tabular-nums text-right">{book.isbn}</dd>
                  </div>
                )}
                {book.pageCount && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-zinc-500">Sayfa Sayısı</dt>
                    <dd className="font-mono text-zinc-900 tabular-nums text-right">
                      {book.pageCount}
                    </dd>
                  </div>
                )}
                {book.publishYear && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-zinc-500">Basım Yılı</dt>
                    <dd className="font-mono text-zinc-900 tabular-nums text-right">
                      {book.publishYear}
                    </dd>
                  </div>
                )}
              </dl>

              {book.description && (
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 mb-1">Özet</h3>
                  <p className="text-sm text-zinc-700 leading-relaxed">{book.description}</p>
                </div>
              )}

              {/* Reading Tracking Block */}
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-zinc-500">Okuma Takibi</h3>

                <div className="grid grid-cols-3 gap-2">
                  {(['okunacak', 'okunuyor', 'okundu'] as ReadingStatus[]).map((st) => {
                    const active = book.readingStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          onUpdateBook({
                            ...book,
                            readingStatus: st,
                            currentPage:
                              st === 'okundu' && book.pageCount
                                ? book.pageCount
                                : st === 'okunacak'
                                ? 0
                                : book.currentPage,
                            finishedAt:
                              st === 'okundu'
                                ? book.finishedAt ?? new Date().toISOString()
                                : undefined,
                          })
                        }
                        className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                          active
                            ? 'bg-emerald-900 text-white border-emerald-900'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        {READING_STATUS_LABELS[st]}
                      </button>
                    );
                  })}
                </div>

                {book.readingStatus === 'okunuyor' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="drawer-current-page">Okunan Sayfa</label>
                      <span className="font-mono tabular-nums">
                        {book.currentPage}
                        {book.pageCount ? ` / ${book.pageCount} (%${pct})` : ''}
                      </span>
                    </div>
                    <input
                      id="drawer-current-page"
                      type="number"
                      min={0}
                      max={book.pageCount || 9999}
                      value={book.currentPage}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        onUpdateBook({
                          ...book,
                          currentPage: book.pageCount ? Math.min(val, book.pageCount) : val,
                        });
                      }}
                      className="w-full h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-mono tabular-nums"
                    />
                  </div>
                )}

                {/* Star Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600">Değerlendirme</span>
                  <div className="inline-flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onUpdateBook({ ...book, rating: star })}
                        aria-label={`${star} yıldız`}
                        className="p-1 rounded hover:bg-zinc-100"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            (book.rating ?? 0) >= star
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-zinc-300'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal Notes */}
                <div>
                  <label htmlFor="drawer-notes" className="block text-xs text-zinc-600 mb-1">
                    Okuma Notları / Alıntılar
                  </label>
                  <textarea
                    id="drawer-notes"
                    rows={3}
                    value={book.notes ?? ''}
                    onChange={(e) => onUpdateBook({ ...book, notes: e.target.value })}
                    placeholder="Kitapla ilgili notlarınız veya sevdiğiniz alıntılar..."
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-800"
                  />
                </div>
              </div>

              {/* Delete section with safe inline confirmation */}
              <div className="pt-4 border-t border-zinc-200">
                {confirmDelete ? (
                  <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <span className="text-xs text-red-900 font-medium">
                      Bu kitap kütüphaneden silinsin mi?
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onDeleteBook(book.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-md"
                      >
                        Evet, Sil
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Kitabı Kütüphaneden Sil</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

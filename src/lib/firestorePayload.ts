import type { Book, BookSource, Bookcase, Box2D, ReadingStatus, ShelfRegion } from '../types/library';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_HEX_REGEX = /^#[0-9a-fA-F]{3,8}$/;
const VALID_REGIONS: ReadonlySet<ShelfRegion> = new Set(['Sol', 'Orta', 'Sağ']);
const VALID_STATUSES: ReadonlySet<ReadingStatus> = new Set(['okunacak', 'okunuyor', 'okundu']);
const VALID_SOURCES: ReadonlySet<BookSource> = new Set(['raf-fotografi', 'barkod', 'manuel']);

export function sanitizeId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 128);
  if (cleaned.length >= 1 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

export function clampString(raw: string | undefined, maxLen: number, fallback = ''): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export function clampInt(val: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, Math.round(val)));
}

export function sanitizeHexColor(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (VALID_HEX_REGEX.test(trimmed)) return trimmed;
  return '#14532D';
}

export function sanitizeFirestorePhotoUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return undefined;
  if (trimmed.startsWith('https://') || trimmed.startsWith('/src/assets/')) {
    return trimmed;
  }
  // Reject data: base64 strings or unsafe schemes for Firestore storage
  return undefined;
}

export function sanitizeBox2d(box: Box2D | undefined): Box2D | undefined {
  if (!Array.isArray(box) || box.length !== 4) return undefined;
  const nums = box.map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1000, Math.max(0, Math.round(n))) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return undefined;
  return [nums[0], nums[1], nums[2], nums[3]];
}

export function buildUserProfileCreatePayload<TTime>(
  uid: string,
  displayName: string | null | undefined,
  photoURL: string | null | undefined,
  serverTime: TTime
): Record<string, unknown> {
  const safePhoto = sanitizeFirestorePhotoUrl(photoURL ?? undefined);
  const payload: Record<string, unknown> = {
    uid: sanitizeId(uid, 'user'),
    displayName: clampString(displayName ?? undefined, 120, 'Rafİzi Okuru'),
    createdAt: serverTime,
    updatedAt: serverTime,
  };
  if (safePhoto) {
    payload.photoURL = safePhoto;
  }
  return payload;
}

export function buildBookcaseCreatePayload<TTime>(
  bookcase: Bookcase,
  ownerId: string,
  serverTime: TTime
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: sanitizeId(bookcase.id, 'bc'),
    ownerId: sanitizeId(ownerId, 'user'),
    name: clampString(bookcase.name, 120, 'Kitaplık'),
    room: clampString(bookcase.room, 80, 'Oda'),
    shelfCount: clampInt(bookcase.shelfCount, 1, 20, 4),
    createdAt: serverTime,
    updatedAt: serverTime,
  };

  const safePhoto = sanitizeFirestorePhotoUrl(bookcase.photoUrl);
  if (safePhoto) {
    payload.photoUrl = safePhoto;
  }
  if (bookcase.photoUpdatedAt) {
    payload.photoUpdatedAt = clampString(bookcase.photoUpdatedAt, 40);
  }
  return payload;
}

export function buildBookCreatePayload<TTime>(
  book: Book,
  ownerId: string,
  serverTime: TTime
): Record<string, unknown> {
  const positionRegion: ShelfRegion = VALID_REGIONS.has(book.positionRegion)
    ? book.positionRegion
    : 'Orta';
  const readingStatus: ReadingStatus = VALID_STATUSES.has(book.readingStatus)
    ? book.readingStatus
    : 'okunacak';
  const source: BookSource = VALID_SOURCES.has(book.source) ? book.source : 'manuel';

  const payload: Record<string, unknown> = {
    id: sanitizeId(book.id, 'book'),
    ownerId: sanitizeId(ownerId, 'user'),
    title: clampString(book.title, 240, 'İsimsiz Kitap'),
    author: clampString(book.author, 160, 'Bilinmeyen Yazar'),
    publisher: clampString(book.publisher, 160, 'Bilinmeyen Yayınevi'),
    category: clampString(book.category, 80, 'Diğer'),
    bookcaseId: sanitizeId(book.bookcaseId, 'bc'),
    shelfRow: clampInt(book.shelfRow, 1, 50, 1),
    positionInShelf: clampInt(book.positionInShelf, 1, 500, 1),
    positionRegion,
    spineColor: sanitizeHexColor(book.spineColor),
    readingStatus,
    currentPage: clampInt(book.currentPage, 0, 10000, 0),
    source,
    addedAt: clampString(book.addedAt, 40, new Date().toISOString()),
    createdAt: serverTime,
    updatedAt: serverTime,
  };

  const isbn = clampString(book.isbn, 32);
  if (isbn) payload.isbn = isbn;

  if (typeof book.pageCount === 'number' && Number.isFinite(book.pageCount) && book.pageCount >= 0) {
    payload.pageCount = clampInt(book.pageCount, 0, 10000, 0);
  }

  if (
    typeof book.publishYear === 'number' &&
    Number.isFinite(book.publishYear) &&
    book.publishYear >= 1000 &&
    book.publishYear <= 2100
  ) {
    payload.publishYear = Math.round(book.publishYear);
  }

  const description = clampString(book.description, 2000);
  if (description) payload.description = description;

  const box2d = sanitizeBox2d(book.box2d);
  if (box2d) payload.box2d = box2d;

  if (typeof book.rating === 'number' && Number.isFinite(book.rating) && book.rating >= 1 && book.rating <= 5) {
    payload.rating = Math.round(book.rating);
  }

  const notes = clampString(book.notes, 4000);
  if (notes) payload.notes = notes;

  const finishedAt = clampString(book.finishedAt, 40);
  if (finishedAt) payload.finishedAt = finishedAt;

  return payload;
}

export function buildBookFullUpdatePayload<TTime, TDelete>(
  book: Book,
  serverTime: TTime,
  deleteSentinel: TDelete
): Record<string, unknown> {
  const positionRegion: ShelfRegion = VALID_REGIONS.has(book.positionRegion)
    ? book.positionRegion
    : 'Orta';
  const readingStatus: ReadingStatus = VALID_STATUSES.has(book.readingStatus)
    ? book.readingStatus
    : 'okunacak';

  const isbn = clampString(book.isbn, 32);
  const description = clampString(book.description, 2000);
  const notes = clampString(book.notes, 4000);
  const finishedAt = clampString(book.finishedAt, 40);
  const box2d = sanitizeBox2d(book.box2d);

  const hasValidPageCount =
    typeof book.pageCount === 'number' && Number.isFinite(book.pageCount) && book.pageCount >= 0;
  const hasValidYear =
    typeof book.publishYear === 'number' &&
    Number.isFinite(book.publishYear) &&
    book.publishYear >= 1000 &&
    book.publishYear <= 2100;
  const hasValidRating =
    typeof book.rating === 'number' && Number.isFinite(book.rating) && book.rating >= 1 && book.rating <= 5;

  return {
    title: clampString(book.title, 240, 'İsimsiz Kitap'),
    author: clampString(book.author, 160, 'Bilinmeyen Yazar'),
    publisher: clampString(book.publisher, 160, 'Bilinmeyen Yayınevi'),
    category: clampString(book.category, 80, 'Diğer'),
    isbn: isbn ? isbn : deleteSentinel,
    pageCount: hasValidPageCount ? clampInt(book.pageCount, 0, 10000, 0) : deleteSentinel,
    publishYear: hasValidYear ? Math.round(book.publishYear!) : deleteSentinel,
    description: description ? description : deleteSentinel,
    bookcaseId: sanitizeId(book.bookcaseId, 'bc'),
    shelfRow: clampInt(book.shelfRow, 1, 50, 1),
    positionInShelf: clampInt(book.positionInShelf, 1, 500, 1),
    positionRegion,
    spineColor: sanitizeHexColor(book.spineColor),
    box2d: box2d ? box2d : deleteSentinel,
    readingStatus,
    currentPage: clampInt(book.currentPage, 0, 10000, 0),
    rating: hasValidRating ? Math.round(book.rating!) : deleteSentinel,
    notes: notes ? notes : deleteSentinel,
    finishedAt: finishedAt ? finishedAt : deleteSentinel,
    updatedAt: serverTime,
  };
}

export function buildReadingStateUpdatePayload<TTime, TDelete>(
  patch: {
    readingStatus?: ReadingStatus;
    currentPage?: number;
    rating?: number;
    notes?: string;
    finishedAt?: string | null;
  },
  serverTime: TTime,
  deleteSentinel: TDelete
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTime,
  };

  if (patch.readingStatus !== undefined && VALID_STATUSES.has(patch.readingStatus)) {
    payload.readingStatus = patch.readingStatus;
  }
  if (patch.currentPage !== undefined) {
    payload.currentPage = clampInt(patch.currentPage, 0, 10000, 0);
  }
  if (patch.rating !== undefined) {
    if (Number.isFinite(patch.rating) && patch.rating >= 1 && patch.rating <= 5) {
      payload.rating = Math.round(patch.rating);
    } else {
      payload.rating = deleteSentinel;
    }
  }
  if (patch.notes !== undefined) {
    const cleaned = clampString(patch.notes, 4000);
    payload.notes = cleaned ? cleaned : deleteSentinel;
  }
  if (patch.finishedAt !== undefined) {
    const cleaned = patch.finishedAt ? clampString(patch.finishedAt, 40) : '';
    payload.finishedAt = cleaned ? cleaned : deleteSentinel;
  }

  return payload;
}

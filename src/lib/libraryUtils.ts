import type {
  Book,
  Bookcase,
  CatalogFilters,
  ShelfRegion,
  SortOption,
} from '../types/library';

/**
 * Normalizes Turkish text for forgiving, case-insensitive search.
 * Maps İ/ı/I -> i, ğ -> g, ü -> u, ş -> s, ö -> o, ç -> c so both
 * exact Turkish queries ("İnce Memed") and ASCII approximations ("ince memed") match.
 */
export function normalizeTurkish(input: string): string {
  return input
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn(raw: string): boolean {
  const isbn = cleanIsbn(raw);
  if (isbn.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const ch = isbn[i];
      const val = i === 9 && ch === 'X' ? 10 : Number(ch);
      if (Number.isNaN(val)) return false;
      sum += val * (10 - i);
    }
    return sum % 11 === 0;
  }
  if (isbn.length === 13) {
    if (!/^\d{13}$/.test(isbn)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = Number(isbn[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === Number(isbn[12]);
  }
  return false;
}

export function inferShelfRegion(position: number, totalInShelf: number): ShelfRegion {
  if (totalInShelf <= 1) return 'Orta';
  const ratio = (position - 1) / Math.max(1, totalInShelf - 1);
  if (ratio < 0.34) return 'Sol';
  if (ratio > 0.66) return 'Sağ';
  return 'Orta';
}

export function formatShelfLocation(book: Book, bookcases: Bookcase[]): string {
  const bookcase = bookcases.find((bc) => bc.id === book.bookcaseId);
  const bcName = bookcase ? bookcase.name : 'Kitaplık';
  return `${bcName} · ${book.shelfRow}. Raf · Soldan ${book.positionInShelf}. kitap (${book.positionRegion})`;
}

export function formatShortLocation(book: Book, bookcases: Bookcase[]): string {
  const bookcase = bookcases.find((bc) => bc.id === book.bookcaseId);
  const bcName = bookcase ? bookcase.name : 'Kitaplık';
  return `${bcName} · ${book.shelfRow}. Raf · #${book.positionInShelf}`;
}

export function matchesBookQuery(book: Book, query: string): boolean {
  const needle = normalizeTurkish(query);
  if (!needle) return true;
  const isbnClean = cleanIsbn(query);
  if (isbnClean.length >= 4 && book.isbn && cleanIsbn(book.isbn).includes(isbnClean)) {
    return true;
  }
  const haystack = normalizeTurkish(
    [book.title, book.author, book.publisher, book.category, book.notes ?? ''].join(' ')
  );
  const tokens = needle.split(' ').filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function filterAndSortBooks(
  books: Book[],
  filters: CatalogFilters,
  sortBy: SortOption
): Book[] {
  const filtered = books.filter((book) => {
    if (filters.query && !matchesBookQuery(book, filters.query)) return false;
    if (filters.category && book.category !== filters.category) return false;
    if (filters.author && book.author !== filters.author) return false;
    if (filters.publisher && book.publisher !== filters.publisher) return false;
    if (filters.bookcaseId && book.bookcaseId !== filters.bookcaseId) return false;
    if (filters.shelfRow !== null && book.shelfRow !== filters.shelfRow) return false;
    if (filters.readingStatus !== 'tumu' && book.readingStatus !== filters.readingStatus) {
      return false;
    }
    if (filters.source !== 'tumu' && book.source !== filters.source) return false;
    return true;
  });

  const sorted = [...filtered];
  const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'baslik-az':
        return collator.compare(a.title, b.title);
      case 'yazar-az':
        return collator.compare(a.author, b.author) || collator.compare(a.title, b.title);
      case 'yayinevi-az':
        return collator.compare(a.publisher, b.publisher) || collator.compare(a.title, b.title);
      case 'son-eklenen':
        return b.addedAt.localeCompare(a.addedAt);
      case 'raf-sirasi':
      default:
        return (
          a.bookcaseId.localeCompare(b.bookcaseId) ||
          a.shelfRow - b.shelfRow ||
          a.positionInShelf - b.positionInShelf
        );
    }
  });

  return sorted;
}

export function findDuplicateBook(
  candidate: { isbn?: string; title: string; author: string },
  existing: Book[]
): Book | undefined {
  const cleanedCandidateIsbn = candidate.isbn ? cleanIsbn(candidate.isbn) : '';
  const normTitle = normalizeTurkish(candidate.title);
  const normAuthor = normalizeTurkish(candidate.author);

  return existing.find((book) => {
    if (cleanedCandidateIsbn && book.isbn && cleanIsbn(book.isbn) === cleanedCandidateIsbn) {
      return true;
    }
    const sameTitle = normalizeTurkish(book.title) === normTitle;
    if (!sameTitle) return false;
    if (!normAuthor || normAuthor === 'bilinmiyor') return true;
    return normalizeTurkish(book.author) === normAuthor;
  });
}

export function calculateReadingProgress(currentPage: number, totalPages?: number): number {
  if (!totalPages || totalPages <= 0) return 0;
  const clamped = Math.max(0, Math.min(currentPage, totalPages));
  return Math.round((clamped / totalPages) * 100);
}

export function applyReadingProgressUpdate(
  book: Book,
  nextPage: number,
  nowIso: string = new Date().toISOString()
): Book {
  const maxPage = book.pageCount && book.pageCount > 0 ? book.pageCount : Math.max(0, nextPage);
  const clampedPage = Math.max(0, Math.min(Math.round(nextPage), maxPage));

  if (book.pageCount && book.pageCount > 0 && clampedPage >= book.pageCount) {
    return {
      ...book,
      currentPage: book.pageCount,
      readingStatus: 'okundu',
      finishedAt: book.finishedAt ?? nowIso,
    };
  }

  if (clampedPage > 0 && book.readingStatus === 'okunacak') {
    return {
      ...book,
      currentPage: clampedPage,
      readingStatus: 'okunuyor',
    };
  }

  if (clampedPage < (book.pageCount ?? Infinity) && book.readingStatus === 'okundu') {
    return {
      ...book,
      currentPage: clampedPage,
      readingStatus: 'okunuyor',
    };
  }

  return {
    ...book,
    currentPage: clampedPage,
  };
}

export interface DirectoryEntry {
  name: string;
  count: number;
  readCount: number;
  books: Book[];
}

export interface LibraryStats {
  totalBooks: number;
  readBooks: number;
  readingBooks: number;
  toReadBooks: number;
  uniqueAuthors: number;
  uniquePublishers: number;
  uniqueCategories: number;
  totalPagesRead: number;
  byPublisher: DirectoryEntry[];
  byAuthor: DirectoryEntry[];
  byCategory: DirectoryEntry[];
}

function buildDirectory(books: Book[], extractor: (book: Book) => string): DirectoryEntry[] {
  const map = new Map<string, Book[]>();
  for (const book of books) {
    const key = extractor(book).trim() || 'Bilinmiyor';
    const list = map.get(key);
    if (list) list.push(book);
    else map.set(key, [book]);
  }
  const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
  return Array.from(map.entries())
    .map(([name, groupBooks]) => ({
      name,
      count: groupBooks.length,
      readCount: groupBooks.filter((b) => b.readingStatus === 'okundu').length,
      books: groupBooks,
    }))
    .sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
}

export function computeLibraryStats(books: Book[]): LibraryStats {
  let readBooks = 0;
  let readingBooks = 0;
  let toReadBooks = 0;
  let totalPagesRead = 0;

  for (const book of books) {
    if (book.readingStatus === 'okundu') {
      readBooks += 1;
      totalPagesRead += book.pageCount && book.pageCount > 0 ? book.pageCount : book.currentPage;
    } else if (book.readingStatus === 'okunuyor') {
      readingBooks += 1;
      totalPagesRead += Math.max(0, book.currentPage);
    } else {
      toReadBooks += 1;
    }
  }

  const byPublisher = buildDirectory(books, (b) => b.publisher);
  const byAuthor = buildDirectory(books, (b) => b.author);
  const byCategory = buildDirectory(books, (b) => b.category);

  return {
    totalBooks: books.length,
    readBooks,
    readingBooks,
    toReadBooks,
    uniqueAuthors: byAuthor.length,
    uniquePublishers: byPublisher.length,
    uniqueCategories: byCategory.length,
    totalPagesRead,
    byPublisher,
    byAuthor,
    byCategory,
  };
}

export function groupBooksByShelf(
  books: Book[],
  bookcaseId: string,
  shelfCount: number
): Array<{ shelfRow: number; books: Book[] }> {
  const maxBookShelf = books
    .filter((b) => b.bookcaseId === bookcaseId)
    .reduce((max, b) => Math.max(max, b.shelfRow), 0);
  const totalRows = Math.max(1, shelfCount, maxBookShelf);

  const rows: Array<{ shelfRow: number; books: Book[] }> = [];
  for (let row = 1; row <= totalRows; row++) {
    const rowBooks = books
      .filter((b) => b.bookcaseId === bookcaseId && b.shelfRow === row)
      .sort((a, b) => a.positionInShelf - b.positionInShelf);
    rows.push({ shelfRow: row, books: rowBooks });
  }
  return rows;
}

export function getNextPositionInShelf(
  books: Book[],
  bookcaseId: string,
  shelfRow: number
): number {
  const sameShelf = books.filter((b) => b.bookcaseId === bookcaseId && b.shelfRow === shelfRow);
  if (sameShelf.length === 0) return 1;
  return Math.max(...sameShelf.map((b) => b.positionInShelf)) + 1;
}

export function isLightHexColor(hex: string): boolean {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return false;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64;
}

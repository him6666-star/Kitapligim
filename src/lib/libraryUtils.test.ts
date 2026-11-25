import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReadingProgressUpdate,
  calculateReadingProgress,
  cleanIsbn,
  computeLibraryStats,
  filterAndSortBooks,
  findDuplicateBook,
  formatShelfLocation,
  getNextPositionInShelf,
  groupBooksByShelf,
  inferShelfRegion,
  isValidIsbn,
  matchesBookQuery,
  normalizeTurkish,
} from './libraryUtils';
import type { Book, Bookcase, CatalogFilters } from '../types/library';

const SAMPLE_BOOKCASES: Bookcase[] = [
  { id: 'bc-salon', name: 'Salon Kitaplığı', room: 'Salon', shelfCount: 3 },
  { id: 'bc-calisma', name: 'Çalışma Odası', room: 'Çalışma Odası', shelfCount: 2 },
];

const SAMPLE_BOOKS: Book[] = [
  {
    id: 'b1',
    title: 'Tutunamayanlar',
    author: 'Oğuz Atay',
    publisher: 'İletişim Yayınları',
    category: 'Roman',
    isbn: '9789754700114',
    pageCount: 724,
    bookcaseId: 'bc-salon',
    shelfRow: 1,
    positionInShelf: 2,
    positionRegion: 'Sol',
    spineColor: '#2B4C3F',
    readingStatus: 'okundu',
    currentPage: 724,
    rating: 5,
    source: 'raf-fotografi',
    addedAt: '2026-10-01T10:00:00.000Z',
    finishedAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'b2',
    title: 'İnce Memed 1',
    author: 'Yaşar Kemal',
    publisher: 'Yapı Kredi Yayınları',
    category: 'Roman',
    isbn: '9789750807145',
    pageCount: 436,
    bookcaseId: 'bc-salon',
    shelfRow: 1,
    positionInShelf: 5,
    positionRegion: 'Sağ',
    spineColor: '#7C2D12',
    readingStatus: 'okunuyor',
    currentPage: 218,
    source: 'barkod',
    addedAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'b3',
    title: 'Dune',
    author: 'Frank Herbert',
    publisher: 'İthaki Yayınları',
    category: 'Bilim Kurgu',
    isbn: '9786053754794',
    pageCount: 712,
    bookcaseId: 'bc-calisma',
    shelfRow: 2,
    positionInShelf: 1,
    positionRegion: 'Sol',
    spineColor: '#1E3A5F',
    readingStatus: 'okunacak',
    currentPage: 0,
    source: 'manuel',
    addedAt: '2026-11-01T10:00:00.000Z',
  },
];

const EMPTY_FILTERS: CatalogFilters = {
  query: '',
  category: '',
  author: '',
  publisher: '',
  bookcaseId: '',
  shelfRow: null,
  readingStatus: 'tumu',
  source: 'tumu',
};

test('normalizeTurkish handles dotted/dotless I and Turkish diacritics consistently', () => {
  assert.equal(normalizeTurkish('İnce Memed'), 'ince memed');
  assert.equal(normalizeTurkish('INCE MEMED'), 'ince memed');
  assert.equal(normalizeTurkish('Oğuz Atay — Şiir & Öykü'), 'oguz atay — siir & oyku');
  assert.equal(matchesBookQuery(SAMPLE_BOOKS[1], 'ince memed'), true);
  assert.equal(matchesBookQuery(SAMPLE_BOOKS[0], 'oguz atay iletisim'), true);
  assert.equal(matchesBookQuery(SAMPLE_BOOKS[2], '9786053754794'), true);
});

test('cleanIsbn and isValidIsbn validate ISBN-10 and ISBN-13 checksums', () => {
  assert.equal(cleanIsbn('978-975-470-011-4'), '9789754700114');
  assert.equal(isValidIsbn('978-975-470-011-4'), true);
  assert.equal(isValidIsbn('978-975-470-011-9'), false);
  assert.equal(isValidIsbn('0-306-40615-2'), true);
  assert.equal(isValidIsbn('12345'), false);
});

test('formatShelfLocation and inferShelfRegion produce human-readable Turkish locations', () => {
  assert.equal(
    formatShelfLocation(SAMPLE_BOOKS[0], SAMPLE_BOOKCASES),
    'Salon Kitaplığı · 1. Raf · Soldan 2. kitap (Sol)'
  );
  assert.equal(inferShelfRegion(1, 9), 'Sol');
  assert.equal(inferShelfRegion(5, 9), 'Orta');
  assert.equal(inferShelfRegion(9, 9), 'Sağ');
});

test('filterAndSortBooks filters by publisher, reading status, and sorts accurately', () => {
  const byPublisher = filterAndSortBooks(
    SAMPLE_BOOKS,
    { ...EMPTY_FILTERS, publisher: 'İthaki Yayınları' },
    'baslik-az'
  );
  assert.equal(byPublisher.length, 1);
  assert.equal(byPublisher[0].title, 'Dune');

  const byAuthorSorted = filterAndSortBooks(SAMPLE_BOOKS, EMPTY_FILTERS, 'yazar-az');
  assert.deepEqual(
    byAuthorSorted.map((b) => b.author),
    ['Frank Herbert', 'Oğuz Atay', 'Yaşar Kemal']
  );
});

test('findDuplicateBook detects duplicates by ISBN or normalized title + author', () => {
  assert.equal(
    findDuplicateBook({ isbn: '978-975-470-011-4', title: 'Farklı', author: 'X' }, SAMPLE_BOOKS)?.id,
    'b1'
  );
  assert.equal(
    findDuplicateBook({ title: 'ince memed 1', author: 'yasar kemal' }, SAMPLE_BOOKS)?.id,
    'b2'
  );
  assert.equal(
    findDuplicateBook({ title: 'Saatleri Ayarlama Enstitüsü', author: 'Ahmet Hamdi Tanpınar' }, SAMPLE_BOOKS),
    undefined
  );
});

test('reading progress update clamps pages and auto-transitions reading status', () => {
  assert.equal(calculateReadingProgress(218, 436), 50);

  const started = applyReadingProgressUpdate(SAMPLE_BOOKS[2], 45, '2026-11-20T00:00:00.000Z');
  assert.equal(started.readingStatus, 'okunuyor');
  assert.equal(started.currentPage, 45);

  const completed = applyReadingProgressUpdate(SAMPLE_BOOKS[1], 999, '2026-11-21T00:00:00.000Z');
  assert.equal(completed.readingStatus, 'okundu');
  assert.equal(completed.currentPage, 436);
  assert.equal(completed.finishedAt, '2026-11-21T00:00:00.000Z');
});

test('computeLibraryStats and groupBooksByShelf aggregate catalog metrics accurately', () => {
  const stats = computeLibraryStats(SAMPLE_BOOKS);
  assert.equal(stats.totalBooks, 3);
  assert.equal(stats.readBooks, 1);
  assert.equal(stats.readingBooks, 1);
  assert.equal(stats.toReadBooks, 1);
  assert.equal(stats.totalPagesRead, 724 + 218);
  assert.equal(stats.uniquePublishers, 3);

  const grouped = groupBooksByShelf(SAMPLE_BOOKS, 'bc-salon', 3);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].books.length, 2);
  assert.equal(getNextPositionInShelf(SAMPLE_BOOKS, 'bc-salon', 1), 6);
});

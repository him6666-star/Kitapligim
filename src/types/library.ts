export type ReadingStatus = 'okunacak' | 'okunuyor' | 'okundu';

export type BookSource = 'raf-fotografi' | 'barkod' | 'manuel';

export type ShelfRegion = 'Sol' | 'Orta' | 'Sağ';

/** Normalized bounding box [ymin, xmin, ymax, xmax] in 0..1000 scale */
export type Box2D = [number, number, number, number];

export interface Bookcase {
  id: string;
  name: string;
  room: string;
  shelfCount: number;
  photoUrl?: string;
  photoUpdatedAt?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  publisher: string;
  category: string;
  isbn?: string;
  pageCount?: number;
  publishYear?: number;
  description?: string;
  bookcaseId: string;
  shelfRow: number; // 1-indexed from top shelf downward
  positionInShelf: number; // 1-indexed from left to right
  positionRegion: ShelfRegion;
  spineColor: string;
  box2d?: Box2D;
  readingStatus: ReadingStatus;
  currentPage: number;
  rating?: number; // 1..5
  notes?: string;
  source: BookSource;
  addedAt: string;
  finishedAt?: string;
}

export interface DetectedShelfBook {
  tempId: string;
  selected: boolean;
  title: string;
  author: string;
  publisher: string;
  category: string;
  shelfRow: number;
  positionInShelf: number;
  positionRegion: ShelfRegion;
  spineColor: string;
  box2d?: Box2D;
  confidence: 'yüksek' | 'orta' | 'düşük';
}

export interface CatalogFilters {
  query: string;
  category: string;
  author: string;
  publisher: string;
  bookcaseId: string;
  shelfRow: number | null;
  readingStatus: ReadingStatus | 'tumu';
  source: BookSource | 'tumu';
}

export type SortOption =
  | 'raf-sirasi'
  | 'baslik-az'
  | 'yazar-az'
  | 'yayinevi-az'
  | 'son-eklenen';

export type ActiveTab = 'katalog' | 'raf-haritasi' | 'okuma-listesi' | 'dizin';

export const BOOK_CATEGORIES = [
  'Roman',
  'Klasikler',
  'Bilim Kurgu',
  'Tarih',
  'Felsefe',
  'Bilim',
  'Psikoloji',
  'Deneme',
  'Şiir',
  'Biyografi',
  'Öykü',
  'Sosyoloji',
  'Ekonomi',
  'Sanat',
  'Diğer',
] as const;

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  okunacak: 'Okunacak',
  okunuyor: 'Okunuyor',
  okundu: 'Okundu',
};

export const SOURCE_LABELS: Record<BookSource, string> = {
  'raf-fotografi': 'Raf Fotoğrafı',
  barkod: 'Barkod (ISBN)',
  manuel: 'Manuel Kayıt',
};

import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Book, Bookcase, ReadingStatus } from '../types/library';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  buildBookcaseCreatePayload,
  buildBookCreatePayload,
  buildBookFullUpdatePayload,
  buildReadingStateUpdatePayload,
  buildUserProfileCreatePayload,
  clampInt,
  clampString,
  sanitizeFirestorePhotoUrl,
  sanitizeId,
} from './firestorePayload';
import { INITIAL_BOOKCASES, INITIAL_BOOKS } from './seedData';

const LOCAL_PHOTO_CACHE_PREFIX = 'rafizi_shelf_photos_v1:';

function readLocalShelfPhotos(uid: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(`${LOCAL_PHOTO_CACHE_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
  } catch {
    // Ignore localStorage access errors
  }
  return {};
}

export function saveLocalShelfPhoto(uid: string, bookcaseId: string, photoDataUrl: string): void {
  if (!photoDataUrl.startsWith('data:')) return;
  try {
    const current = readLocalShelfPhotos(uid);
    current[bookcaseId] = photoDataUrl;
    window.localStorage.setItem(`${LOCAL_PHOTO_CACHE_PREFIX}${uid}`, JSON.stringify(current));
  } catch {
    // Ignore quota errors if browser storage is full
  }
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const nextDisplayName = clampString(user.displayName ?? undefined, 120, 'Rafİzi Okuru');
    const nextPhotoUrl = sanitizeFirestorePhotoUrl(user.photoURL ?? undefined);

    if (!snap.exists()) {
      await setDoc(
        ref,
        buildUserProfileCreatePayload(user.uid, nextDisplayName, nextPhotoUrl, serverTimestamp())
      );
      return;
    }

    const existing = snap.data();
    const shouldUpdateName = existing.displayName !== nextDisplayName;
    const shouldUpdatePhoto = (existing.photoURL ?? undefined) !== nextPhotoUrl;

    if (shouldUpdateName || shouldUpdatePhoto) {
      await updateDoc(ref, {
        displayName: nextDisplayName,
        photoURL: nextPhotoUrl ? nextPhotoUrl : deleteField(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserLibrary(
  uid: string,
  callbacks: {
    onBookcases: (bookcases: Bookcase[]) => void;
    onBooks: (books: Book[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const bookcasesPath = `users/${uid}/bookcases`;
  const booksPath = `users/${uid}/books`;

  const bookcasesQuery = query(collection(db, 'users', uid, 'bookcases'), where('ownerId', '==', uid));
  const booksQuery = query(collection(db, 'users', uid, 'books'), where('ownerId', '==', uid));

  const unsubBookcases = onSnapshot(
    bookcasesQuery,
    (snapshot) => {
      const localPhotos = readLocalShelfPhotos(uid);
      const list: Bookcase[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const id = typeof d.id === 'string' ? d.id : docSnap.id;
        return {
          id,
          name: String(d.name ?? 'Kitaplık'),
          room: String(d.room ?? 'Oda'),
          shelfCount: typeof d.shelfCount === 'number' ? d.shelfCount : 4,
          photoUrl: typeof d.photoUrl === 'string' && d.photoUrl ? d.photoUrl : localPhotos[id],
          photoUpdatedAt: typeof d.photoUpdatedAt === 'string' ? d.photoUpdatedAt : undefined,
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      callbacks.onBookcases(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, bookcasesPath);
      } catch (wrapped) {
        callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubBooks = onSnapshot(
    booksQuery,
    (snapshot) => {
      const list: Book[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: typeof d.id === 'string' ? d.id : docSnap.id,
          title: String(d.title ?? ''),
          author: String(d.author ?? ''),
          publisher: String(d.publisher ?? ''),
          category: String(d.category ?? 'Diğer'),
          isbn: typeof d.isbn === 'string' ? d.isbn : undefined,
          pageCount: typeof d.pageCount === 'number' ? d.pageCount : undefined,
          publishYear: typeof d.publishYear === 'number' ? d.publishYear : undefined,
          description: typeof d.description === 'string' ? d.description : undefined,
          bookcaseId: String(d.bookcaseId ?? ''),
          shelfRow: typeof d.shelfRow === 'number' ? d.shelfRow : 1,
          positionInShelf: typeof d.positionInShelf === 'number' ? d.positionInShelf : 1,
          positionRegion: d.positionRegion === 'Sol' || d.positionRegion === 'Sağ' ? d.positionRegion : 'Orta',
          spineColor: typeof d.spineColor === 'string' ? d.spineColor : '#14532D',
          box2d: Array.isArray(d.box2d) && d.box2d.length === 4 ? (d.box2d as Book['box2d']) : undefined,
          readingStatus:
            d.readingStatus === 'okunuyor' || d.readingStatus === 'okundu'
              ? d.readingStatus
              : 'okunacak',
          currentPage: typeof d.currentPage === 'number' ? d.currentPage : 0,
          rating: typeof d.rating === 'number' ? d.rating : undefined,
          notes: typeof d.notes === 'string' ? d.notes : undefined,
          source:
            d.source === 'raf-fotografi' || d.source === 'barkod' ? d.source : 'manuel',
          addedAt: typeof d.addedAt === 'string' ? d.addedAt : new Date().toISOString(),
          finishedAt: typeof d.finishedAt === 'string' ? d.finishedAt : undefined,
        };
      });
      list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
      callbacks.onBooks(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, booksPath);
      } catch (wrapped) {
        callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubBookcases();
    unsubBooks();
  };
}

export async function createBookcaseInCloud(
  uid: string,
  newBc: Omit<Bookcase, 'id'>
): Promise<Bookcase> {
  const id = sanitizeId(`bc-${Date.now()}`, 'bc');
  const bookcase: Bookcase = { ...newBc, id };
  const path = `users/${uid}/bookcases/${id}`;

  if (bookcase.photoUrl?.startsWith('data:')) {
    saveLocalShelfPhoto(uid, id, bookcase.photoUrl);
  }

  try {
    await setDoc(
      doc(db, 'users', uid, 'bookcases', id),
      buildBookcaseCreatePayload(bookcase, uid, serverTimestamp())
    );
    return bookcase;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addBooksBatchInCloud(
  uid: string,
  newBooks: Array<Omit<Book, 'id' | 'addedAt'>>,
  existingBookcases: Bookcase[],
  shelfPhotoUpdate?: { bookcaseId: string; photoUrl: string }
): Promise<Book[]> {
  const now = new Date().toISOString();
  const baseTs = Date.now();
  const created: Book[] = newBooks.map((item, idx) => ({
    ...item,
    id: sanitizeId(`book-${baseTs}-${idx}`, 'book'),
    addedAt: now,
  }));

  // Cache base64 shelf photo locally so Firestore documents stay small & compliant
  if (shelfPhotoUpdate && shelfPhotoUpdate.photoUrl.startsWith('data:')) {
    saveLocalShelfPhoto(uid, shelfPhotoUpdate.bookcaseId, shelfPhotoUpdate.photoUrl);
  }

  const maxRowByBc = new Map<string, number>();
  for (const item of created) {
    const currentMax = maxRowByBc.get(item.bookcaseId) ?? 0;
    if (item.shelfRow > currentMax) maxRowByBc.set(item.bookcaseId, item.shelfRow);
  }

  const batch = writeBatch(db);

  // Update any affected bookcases (expanded shelf count or photo update)
  for (const bc of existingBookcases) {
    const neededRows = maxRowByBc.get(bc.id) ?? 0;
    const isPhotoTarget = shelfPhotoUpdate && shelfPhotoUpdate.bookcaseId === bc.id;
    const nextShelfCount = clampInt(Math.max(bc.shelfCount, neededRows), 1, 20, bc.shelfCount);

    if (nextShelfCount !== bc.shelfCount || isPhotoTarget) {
      const bcRef = doc(db, 'users', uid, 'bookcases', bc.id);
      const patch: Record<string, unknown> = {
        shelfCount: nextShelfCount,
        updatedAt: serverTimestamp(),
      };
      if (isPhotoTarget) {
        const safeUrl = sanitizeFirestorePhotoUrl(shelfPhotoUpdate.photoUrl);
        if (safeUrl) {
          patch.photoUrl = safeUrl;
        }
        patch.photoUpdatedAt = now;
      }
      batch.update(bcRef, patch);
    }
  }

  // Create book documents
  for (const book of created) {
    const bookRef = doc(db, 'users', uid, 'books', book.id);
    batch.set(bookRef, buildBookCreatePayload(book, uid, serverTimestamp()));
  }

  const path = `users/${uid}/books`;
  try {
    await batch.commit();
    return created;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateBookInCloud(uid: string, updated: Book): Promise<void> {
  const path = `users/${uid}/books/${updated.id}`;
  try {
    await updateDoc(
      doc(db, 'users', uid, 'books', updated.id),
      buildBookFullUpdatePayload(updated, serverTimestamp(), deleteField())
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateBookReadingStateInCloud(
  uid: string,
  bookId: string,
  patch: {
    readingStatus?: ReadingStatus;
    currentPage?: number;
    rating?: number;
    notes?: string;
    finishedAt?: string | null;
  }
): Promise<void> {
  const path = `users/${uid}/books/${bookId}`;
  try {
    await updateDoc(
      doc(db, 'users', uid, 'books', bookId),
      buildReadingStateUpdatePayload(patch, serverTimestamp(), deleteField())
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookInCloud(uid: string, bookId: string): Promise<void> {
  const path = `users/${uid}/books/${bookId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importLibraryToCloud(
  user: User,
  data: { bookcases: Bookcase[]; books: Book[] }
): Promise<void> {
  const uid = user.uid;
  const path = `users/${uid}`;

  // Ensure profile exists first
  await ensureUserProfile(user);

  const validBookcaseIds = new Set<string>();
  const batch = writeBatch(db);

  for (const bc of data.bookcases) {
    const safeBcId = sanitizeId(bc.id, 'bc');
    validBookcaseIds.add(safeBcId);
    if (bc.photoUrl?.startsWith('data:')) {
      saveLocalShelfPhoto(uid, safeBcId, bc.photoUrl);
    }
    const bcRef = doc(db, 'users', uid, 'bookcases', safeBcId);
    batch.set(
      bcRef,
      buildBookcaseCreatePayload({ ...bc, id: safeBcId }, uid, serverTimestamp())
    );
  }

  const fallbackBookcaseId = Array.from(validBookcaseIds)[0];
  if (fallbackBookcaseId) {
    for (const book of data.books) {
      const safeBookId = sanitizeId(book.id, 'book');
      const targetBcId = validBookcaseIds.has(sanitizeId(book.bookcaseId, 'bc'))
        ? sanitizeId(book.bookcaseId, 'bc')
        : fallbackBookcaseId;
      const bookRef = doc(db, 'users', uid, 'books', safeBookId);
      batch.set(
        bookRef,
        buildBookCreatePayload(
          { ...book, id: safeBookId, bookcaseId: targetBcId },
          uid,
          serverTimestamp()
        )
      );
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedSampleLibraryInCloud(user: User): Promise<void> {
  await importLibraryToCloud(user, {
    bookcases: INITIAL_BOOKCASES,
    books: INITIAL_BOOKS,
  });
}

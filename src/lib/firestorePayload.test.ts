import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBookcaseCreatePayload,
  buildBookCreatePayload,
  buildBookFullUpdatePayload,
  buildReadingStateUpdatePayload,
  sanitizeBox2d,
  sanitizeFirestorePhotoUrl,
  sanitizeHexColor,
  sanitizeId,
} from './firestorePayload.ts';
import type { Book, Bookcase } from '../types/library.ts';

const MOCK_TIME = { __sentinel: 'serverTimestamp' };
const MOCK_DELETE = { __sentinel: 'deleteField' };

describe('firestorePayload security & schema sanitizers', () => {
  it('sanitizes document IDs to match ^[a-zA-Z0-9_-]+$ and max 128 chars', () => {
    assert.equal(sanitizeId('bc-salon_1'), 'bc-salon_1');
    assert.match(sanitizeId('../../evil$id with spaces'), /^[a-zA-Z0-9_-]+$/);
    assert.ok(sanitizeId('a'.repeat(300)).length <= 128);
  });

  it('blocks base64 data URLs and javascript: schemes from Firestore photoUrl', () => {
    assert.equal(
      sanitizeFirestorePhotoUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='),
      undefined
    );
    assert.equal(sanitizeFirestorePhotoUrl('javascript:alert(1)'), undefined);
    assert.equal(
      sanitizeFirestorePhotoUrl('/src/assets/images/sample_salon_shelf.jpg'),
      '/src/assets/images/sample_salon_shelf.jpg'
    );
    assert.equal(
      sanitizeFirestorePhotoUrl('https://lh3.googleusercontent.com/a/avatar'),
      'https://lh3.googleusercontent.com/a/avatar'
    );
  });

  it('clamps box2d coordinates to [0, 1000] and rejects malformed arrays', () => {
    assert.deepEqual(sanitizeBox2d([-10, 50.4, 1200, 999]), [0, 50, 1000, 999]);
    assert.equal(sanitizeBox2d([1, 2, 3] as unknown as Book['box2d']), undefined);
    assert.equal(sanitizeBox2d([1, NaN, 3, 4]), undefined);
  });

  it('normalizes invalid spine hex colors to Forest Ink fallback', () => {
    assert.equal(sanitizeHexColor('#7C2D12'), '#7C2D12');
    assert.equal(sanitizeHexColor('rgb(0,0,0)'), '#14532D');
  });

  it('builds Bookcase create payload strictly matching firestore.rules allowed keys', () => {
    const bc: Bookcase = {
      id: 'bc-salon',
      name: 'Salon Kitaplığı',
      room: 'Salon',
      shelfCount: 4,
      photoUrl: 'data:image/jpeg;base64,HUGE_BLOB',
    };
    const payload = buildBookcaseCreatePayload(bc, 'user_123', MOCK_TIME);
    assert.equal(payload.id, 'bc-salon');
    assert.equal(payload.ownerId, 'user_123');
    assert.equal('photoUrl' in payload, false);
    assert.equal(payload.createdAt, MOCK_TIME);
    assert.equal(payload.updatedAt, MOCK_TIME);
  });

  it('builds Book create and update payloads preserving immutability and clearing optional fields safely', () => {
    const book: Book = {
      id: 'book-1',
      title: 'Saatleri Ayarlama Enstitüsü',
      author: 'Ahmet Hamdi Tanpınar',
      publisher: 'Dergâh Yayınları',
      category: 'Roman',
      isbn: '9789759955762',
      pageCount: 382,
      bookcaseId: 'bc-salon',
      shelfRow: 2,
      positionInShelf: 3,
      positionRegion: 'Sol',
      spineColor: '#14532D',
      readingStatus: 'okunuyor',
      currentPage: 120,
      source: 'raf-fotografi',
      addedAt: '2026-11-20T10:00:00.000Z',
    };

    const createPayload = buildBookCreatePayload(book, 'user_123', MOCK_TIME);
    assert.equal(createPayload.ownerId, 'user_123');
    assert.equal(createPayload.createdAt, MOCK_TIME);
    assert.equal('notes' in createPayload, false);

    const updatePayload = buildBookFullUpdatePayload(book, MOCK_TIME, MOCK_DELETE);
    assert.equal('id' in updatePayload, false);
    assert.equal('ownerId' in updatePayload, false);
    assert.equal('source' in updatePayload, false);
    assert.equal('addedAt' in updatePayload, false);
    assert.equal('createdAt' in updatePayload, false);
    assert.equal(updatePayload.notes, MOCK_DELETE);
    assert.equal(updatePayload.updatedAt, MOCK_TIME);

    const readingPatch = buildReadingStateUpdatePayload(
      { readingStatus: 'okunacak', currentPage: 0, finishedAt: null },
      MOCK_TIME,
      MOCK_DELETE
    );
    assert.deepEqual(Object.keys(readingPatch).sort(), [
      'currentPage',
      'finishedAt',
      'readingStatus',
      'updatedAt',
    ]);
    assert.equal(readingPatch.finishedAt, MOCK_DELETE);
  });
});

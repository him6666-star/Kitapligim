# Rafİzi Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Per-User Tenant Isolation**: Every document under `/users/{userId}`, `/users/{userId}/bookcases/{bookcaseId}`, and `/users/{userId}/books/{bookId}` is strictly private to the authenticated user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true` (for writes). No cross-user reads or writes are ever permitted.
2. **Master Gate Parent Integrity**:
   - A `Bookcase` cannot be created unless the parent `/users/{userId}` document exists (or is atomically created in the same batch via `existsAfter`).
   - A `Book` cannot be created unless both the parent `/users/{userId}` and referenced `/users/{userId}/bookcases/{bookcaseId}` exist (via `existsAfter`).
3. **Immutable Ownership & Provenance**: `uid`, `id`, `ownerId`, `source`, `addedAt`, and `createdAt` can never be mutated after document creation.
4. **Temporal Integrity**: `createdAt` must equal `request.time` on create; `updatedAt` must equal `request.time` on both create and update.
5. **Bounded Types & Anti-Denial-of-Wallet**: Every document ID matches `^[a-zA-Z0-9_\-]+$` with max length 128. Every string has an explicit `.size()` bound. `photoUrl` rejects raw base64 `data:` blobs (>500 chars / invalid scheme) so documents remain well under Firestore's 1MB limit. `box2d`, when present, is strictly a 4-element numeric list with values in `[0, 1000]`.
6. **Zero Client-Delegated List Queries**: `allow list` on `/users/{userId}/bookcases` and `/users/{userId}/books` explicitly enforces `isOwner(userId) && resource.data.ownerId == request.auth.uid` without any `get()`/`exists()` lookups inside `list`. Listing `/users` is completely denied.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Cross-User Read (`GET /users/victimUid/books/book-1` as `attackerUid`)**
   - Payload: N/A (read request by non-owner).
   - Expected: Denied by `isOwner(userId)`.
2. **Unverified Email Write (`CREATE /users/u1/bookcases/bc-1` with `email_verified: false`)**
   - Payload: `{ "id": "bc-1", "ownerId": "u1", "name": "Salon", "room": "Salon", "shelfCount": 4, "createdAt": "<serverTime>", "updatedAt": "<serverTime>" }`
   - Expected: Denied by `isVerifiedUser()`.
3. **Identity Spoofing on Create (`CREATE /users/u1/books/book-1` with `ownerId: "u2"`)**
   - Payload: `{ "id": "book-1", "ownerId": "u2", "title": "Saatleri Ayarlama Enstitüsü", ... }`
   - Expected: Denied by `data.ownerId == request.auth.uid && data.ownerId == userId`.
4. **Shadow Field Injection on Create (`CREATE /users/u1` with extra `isAdmin: true`)**
   - Payload: `{ "uid": "u1", "displayName": "Test", "isAdmin": true, "createdAt": "<serverTime>", "updatedAt": "<serverTime>" }`
   - Expected: Denied by `data.keys().hasOnly(...)`.
5. **Shadow Field Injection on Update (`UPDATE /users/u1/books/book-1` adding `role: "admin"`)**
   - Payload: `{ "readingStatus": "okundu", "role": "admin", "updatedAt": "<serverTime>" }`
   - Expected: Denied by `isValidBook(...)` and `affectedKeys().hasOnly(...)`.
6. **ID Poisoning Attack (`CREATE /users/u1/bookcases/../../evil$id`)**
   - Payload: Document ID containing disallowed characters or length > 128.
   - Expected: Denied by `isValidId(bookcaseId)`.
7. **Orphaned Book Creation (`CREATE /users/u1/books/book-9` referencing non-existent `bookcaseId: "bc-ghost"`)**
   - Payload: Valid book fields with `bookcaseId: "bc-ghost"` that does not exist in `/users/u1/bookcases`.
   - Expected: Denied by `existsAfter(/databases/$(database)/documents/users/$(userId)/bookcases/$(incoming().bookcaseId))`.
8. **Client Timestamp Forgery (`CREATE /users/u1/bookcases/bc-2` with backdated `createdAt`)**
   - Payload: `{ "id": "bc-2", "ownerId": "u1", "name": "Oda", "room": "Oda", "shelfCount": 3, "createdAt": "2020-01-01T00:00:00Z", "updatedAt": "<serverTime>" }`
   - Expected: Denied by `incoming().createdAt == request.time`.
9. **Immutable Field Mutation (`UPDATE /users/u1/books/book-1` changing `ownerId` or `addedAt`)**
   - Payload: `{ "ownerId": "u2", "updatedAt": "<serverTime>" }`
   - Expected: Denied by immutability checks and `affectedKeys().hasOnly(...)`.
10. **Value Poisoning / Oversized Payload (`UPDATE /users/u1/bookcases/bc-1` setting `photoUrl` to a 900KB `data:image/jpeg;base64,...` string)**
    - Payload: `{ "photoUrl": "data:image/jpeg;base64,...", "updatedAt": "<serverTime>" }`
    - Expected: Denied by `isValidPhotoUrl(data.photoUrl)` (size <= 500 and allowed prefix check).
11. **Malformed `box2d` Array Injection (`CREATE /users/u1/books/book-2` with `box2d: ["bad", 1, 2, 3, 4]`)**
    - Payload: Book payload with non-numeric or wrong-length `box2d`.
    - Expected: Denied by `isValidBox2d(data.box2d)`.
12. **Unscoped List Enumeration (`LIST /users` or `LIST /users/u1/books` without `ownerId` filter matching `request.auth.uid`)**
    - Payload: Collection list query violating owner invariant.
    - Expected: Denied by default-deny on `/users` list and `resource.data.ownerId == request.auth.uid` on subcollection `allow list`.

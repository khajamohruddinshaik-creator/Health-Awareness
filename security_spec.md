# Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: No collection or document is readable or writable unless explicitly permitted.
2. **Verified Admin Gate**: Administrator access requires `request.auth != null`, `request.auth.token.email_verified == true`, and either a matching `/admins/{uid}` document or the bootstrapped administrator email (`khajamohruddinshaik@gmail.com`).
3. **PII Protection on `/users/{userId}`**: Registered user records contain PII (`name`, `email`, `phone`). Blanket `isSignedIn()` reads and `list` queries by normal users are strictly forbidden.
4. **No Self-Assigned Admin Roles**: Normal users cannot create, update, or delete documents in `/admins/{adminUid}` or escalate `role` to `'admin'` in `/users/{userId}`.
5. **Validation Blueprints & Boundary Limits**: Every document write validates exact allowed keys (`hasAll` + `hasOnly`), field types, string `.size()` bounds, 10-digit phone regex, and document ID format (`^[a-zA-Z0-9_-]+$`).

## 2. Adversarial Test Vectors
1. Unauthenticated read on `/users` -> `PERMISSION_DENIED`
2. Unauthenticated write to `/users/123` -> `PERMISSION_DENIED`
3. Normal signed-in user `list` query on `/users` -> `PERMISSION_DENIED`
4. Normal signed-in user `get` on another user `/users/456` -> `PERMISSION_DENIED`
5. Normal signed-in user attempting to create `/admins/{uid}` -> `PERMISSION_DENIED`
6. Spoofed unverified email (`email: khajamohruddinshaik@gmail.com`, `email_verified: false`) -> `PERMISSION_DENIED`
7. Admin write to `/users/123` with extra ghost field `isAdmin: true` -> `PERMISSION_DENIED`
8. Admin write to `/users/123` with invalid 5-digit `phone` -> `PERMISSION_DENIED`
9. Admin write to `/users/123` with oversized `name` (> 120 chars) -> `PERMISSION_DENIED`
10. Admin update on `/users/123` attempting to mutate immutable `id` or `createdAt` -> `PERMISSION_DENIED`
11. Admin write to `/users/{oversizedId}` (> 128 chars or invalid chars) -> `PERMISSION_DENIED`
12. Any read/write on undeclared collection `/secrets/doc` -> `PERMISSION_DENIED`

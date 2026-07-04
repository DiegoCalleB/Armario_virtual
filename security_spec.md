# Security Specifications for Espejo IA (Firebase Firestore)

This document outlines the security rules, invariants, and test payload specifications for the Firestore collections in Espejo IA.

## 1. Data Invariants
- **Rostro**: A user's rostro document must have its document ID equal to the authenticated user's `uid` (to enforce 1-to-1 relationship) OR have `user_id == request.auth.uid`.
- **Prendas**: A garment (prenda) document must have `user_id == request.auth.uid`. Users cannot read or modify garments belonging to other users.
- **Historial**: An item in the historical look logs must have `user_id == request.auth.uid`. Users cannot read or modify logs of other users.

## 2. The "Dirty Dozen" (Vulnerability Vector Payloads)
The following payloads must be explicitly blocked by the Firestore security rules:

1. **Identity Spoofing on Rostro Creation**: An authenticated user `user_A` attempts to create a rostro document with a document ID of `user_B` or `user_id: "user_B"`.
2. **Ghost Field Injection in Rostro**: An authenticated user attempts to inject an unauthorized `isAdmin: true` or similar field into their rostro document.
3. **Privilege Escalation on Prenda**: An attacker tries to write `user_id: "user_B"` inside a prenda document to associate their item with another user's wardrobe.
4. **Bypassing Rostro Immutability**: An attacker attempts to update `user_id` in their rostro document.
5. **Garment Size Poisoning**: An attacker tries to upload a prenda where `nombre` is a 1MB string.
6. **Negative Size Tags List**: An attacker tries to set `tags` list size to more than 20 tags.
7. **Unauthenticated Read of Wardrobe**: A guest (unauthenticated) user attempts to list the `/prendas` collection.
8. **Unauthenticated Write to Historial**: A guest attempts to log a historical look under `/historial/some-id`.
9. **Relational Spoofing in Historial**: A user logs a look containing garment IDs they don't own. (Optional check, but we enforce `user_id` ownership).
10. **Cross-user Read on Historial**: User A attempts to execute a query/get to read User B's historical logs.
11. **Immutability Breach on Historial Date**: Attempting to alter the `created_at` or `fecha` of a historical entry after creation.
12. **Junk Characters ID Poisoning**: Attempting to create a prenda with document ID containing 1000 special characters to exhaust Firestore space or query limits.

## 3. Test Cases (Verification Expectations)
- **Rostro matching**: `request.auth.uid == userId`.
- **Prenda ownership**: `resource.data.user_id == request.auth.uid` for read/write.
- **Historial ownership**: `resource.data.user_id == request.auth.uid` for read/write.

# IMnexus Firestore Security Specification

## 1. Data Invariants
1. **Master Gate & Ownership**: Every `/cases/{caseId}` subcollection (`sections`, `timeline`, `actors`, `collaborators`) MUST validate against its parent `/cases/{caseId}` document via `get()`. Access revocation on the parent case immediately revokes subcollection access.
2. **Identity Integrity**: On `create`, `ownerId` MUST strictly equal `request.auth.uid`, and `request.auth.token.email_verified == true` is required for all authenticated writes.
3. **Immutability**: `ownerId`, `caseId`, and `createdAt` are immutable after creation.
4. **RBAC Enforcement**: Non-admin users cannot self-assign `role: 'admin'` on `/users/{userId}` creation or escalate their own role on update. Only the bootstrapped admin (`demopocrisyrepository@gmail.com` with verified email) or `/admins/{uid}` members can grant/revoke workspace roles.
5. **PII Isolation**: `/users/{userId}` documents (containing email) are readable only by the owner (`request.auth.uid == userId`) or an Admin (`isAdmin()`).
6. **Public Site Isolation**: Unauthenticated public visitors can ONLY read `/publicSites/{slug}` where `resource.data.published == true`. Private cases, vault items, and collections remain strictly inaccessible to unauthenticated users.
7. **Temporal Integrity**: `createdAt == request.time` on `create` and `updatedAt == request.time` on `update`.
8. **Bounded Collections & Path IDs**: All document IDs match `^[a-zA-Z0-9_\-]+$` (and slugs match `^[a-z0-9\-]+$`) with `.size() <= 128`. All arrays are bounded (`memberUids <= 20`, `tags <= 20`, `itemIds <= 50`).

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unverified Email Write**: Creating `/cases/c1` with `email_verified: false`.
2. **Identity Spoofing on Create**: Creating `/cases/c2` with `ownerId: "victim_uid"` while authenticated as `"attacker_uid"`.
3. **Self-Privilege Escalation on Signup**: Creating `/users/attacker_uid` with `role: "admin"` as a regular user.
4. **Role Escalation on Update**: Updating `/users/attacker_uid` to change `role` from `"viewer"` to `"admin"`.
5. **Shadow / Ghost Field Injection**: Creating `/vaultItems/v1` with an extra unallowed key `isAdminApproved: true`.
6. **Oversized ID Poisoning**: Attempting `get` or `create` on `/cases/` with a 512-char ID or invalid characters `../admin`.
7. **Owner Reassignment Attack**: Updating `/cases/c1` to change `ownerId` from owner to another UID.
8. **Unbounded Array / Denial of Wallet**: Creating `/collections/col1` with 200 items in `itemIds` (> 50 limit).
9. **Client Timestamp Forgery**: Creating `/cases/c1` with `createdAt` set to a past client date instead of `request.time`.
10. **PII Blanket Read**: Signed-in non-admin user attempting `get` or `list` on `/users/other_uid`.
11. **Unpublished Public Site Scraping**: Anonymous visitor reading `/publicSites/draft-site` where `published == false`.
12. **Orphan Subcollection Write**: Creating `/cases/nonexistent_case/timeline/t1` when parent `/cases/nonexistent_case` does not exist.

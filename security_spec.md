# Security Specification — Kerala State BSG Camporee Hub

## 1. Data Invariants
1. **Public Guest Read Boundary**: Guests can read `campLocations`, `venues`, `activities`, and `camporeeConfig/general` without authentication. Guests can NEVER read `juryMembers` (emails/PII), `attendance` (participant/verifier records), `admins`, or `camporeeConfig/sheets`.
2. **Admin-Only Schedule & Venue Control**: Only verified Camporee Admins (`isAdmin()`) can create, update, or delete `campLocations`, `venues`, `activities`, `juryMembers`, `admins`, and `camporeeConfig`.
3. **Jury Role Isolation & Activity Binding**: Only active entries in `juryMembers/{lowercaseEmail}` with `request.auth.token.email_verified == true` qualify as `isJury()`. Jury members cannot edit venue details, program times, or assign themselves.
4. **Attendance Integrity & Temporal Anchoring**: An `attendance` record cannot exist without a valid parent `activityId` (`exists(/databases/$(database)/documents/activities/$(incoming().activityId))`). `verifiedByUid` must match `request.auth.uid`, `verifiedByEmail` must match `request.auth.token.email.lower()`, and `createdAt` must equal `request.time`.
5. **Immutable Audit Trail**: Once created, `verifiedByUid`, `verifiedByEmail`, `uidNumber`, `activityId`, and `createdAt` on an `attendance` record cannot be modified by Jury. Jury can only update Google Sheets sync metadata (`sheetSynced`, `sheetRowRange`, `driveFileId`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Guest Venue Tamper**: Unauthenticated write to `/venues/main-arena` -> `PERMISSION_DENIED`.
2. **Non-Admin Time Edit**: Authenticated non-admin updates `startTime` on `/activities/flag-break` -> `PERMISSION_DENIED`.
3. **Unverified Email Admin Spoof**: Token with `email: "ethnicelegance.kochi@gmail.com"` and `email_verified: false` attempts write to `/activities/a1` -> `PERMISSION_DENIED`.
4. **Self-Assigned Jury Escalation**: Non-admin user attempts write to `/juryMembers/attacker@example.com` with `active: true` -> `PERMISSION_DENIED`.
5. **PII Leak via Jury List**: Unauthenticated or non-jury user attempts `list` on `/juryMembers` -> `PERMISSION_DENIED`.
6. **PII Leak via Attendance Scrape**: Guest attempts `get` or `list` on `/attendance` -> `PERMISSION_DENIED`.
7. **Orphaned Attendance Record**: Jury creates `/attendance/att-1` referencing non-existent `activityId: "fake-activity"` -> `PERMISSION_DENIED`.
8. **Verifier Identity Spoofing**: Jury creates `/attendance/att-2` with `verifiedByUid: "someone-else"` -> `PERMISSION_DENIED`.
9. **Shadow Field Injection**: Admin or Jury sends extra field `isBypassed: true` on `/attendance/att-3` -> `PERMISSION_DENIED` (`hasOnly` rejects).
10. **ID Poisoning (1.5KB Document ID)**: Write to `/campLocations/<200-char-id>` -> `PERMISSION_DENIED` (`isValidId` rejects > 128 chars or invalid characters).
11. **Client Timestamp Forgery**: Jury creates `/attendance/att-4` with backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Immutable Attendance Overwrite**: Jury attempts to alter `uidNumber` on existing `/attendance/att-5` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly` rejects).

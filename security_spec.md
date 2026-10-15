# Security Specification for FintechCore Firestore Security Rules

## 1. Data Invariants

1. **User Identity Invariant**: A user document at `/users/{userId}` and all subcollections (`/users/{userId}/transactions/{transactionId}`, `/users/{userId}/projects/{projectId}`, etc.) must strictly belong to the authenticated user matching `request.auth.uid == userId`.
2. **Transaction Integrity Invariant**: All transactions must have required non-empty fields (`descricao`, `valor`, `data`, `categoria`, `tipoItem`, `userId`) and `userId` must strictly match `request.auth.uid`.
3. **No Cross-Tenant Access Invariant**: User A (`user_alpha`) cannot read, write, update, or delete any resources under `/users/{user_beta}`.
4. **Input Size Limits**: All string fields are constrained with bounded length (`maxLength <= 250` for descriptions, `<= 128` for IDs, `<= 80` for names and categories) to prevent Denial of Wallet.
5. **No Blind Blanket Queries**: Every list query is scoped to the authenticated user's own path (`/users/{userId}/...`).

## 2. The Dirty Dozen Payloads (Designed to Fail / PERMISSION_DENIED)

1. **Unauthenticated Write**: Writing a transaction without `request.auth`.
2. **Cross-Tenant Impersonation**: User `attacker_uid` attempting to write to `/users/victim_uid/transactions/t1`.
3. **Spoofed User ID in Body**: Payload contains `userId: 'victim_uid'` while auth is `attacker_uid`.
4. **Invalid Transaction Type**: Payload contains `tipoItem: 'investimento'` when only `despesa` and `receita` are allowed.
5. **Payload Overflow (Denial of Wallet)**: `descricao` exceeds 250 characters.
6. **Non-Numeric Amount**: `valor: "150.00"` as string instead of float/number.
7. **Invalid Path Injection**: Document ID containing path traversal or illegal characters (e.g., `../../etc`).
8. **Negative Or Corrupted Project Goal**: `valor: -5000` or missing `dataAlvo`.
9. **Tampered Owner on Update**: Modifying a transaction with an update diff attempting to change `userId`.
10. **Ghost Fields Injection**: Adding unauthorized schema attributes like `isAdmin: true` or `role: 'superadmin'`.
11. **Cross-User Project Deletion**: User A attempting to delete `/users/user_B/projects/p1`.
12. **Malformed Account Type**: Bank account `tipo` set to `bitcoin_wallet` when enum only allows `corrente`, `credito`, `poupanca`, `investimento`.

## 3. Test Runner Design

The security rules are evaluated to strictly deny unauthenticated access, deny cross-user access, and enforce schema boundaries on create and update.

# 🏗️ SM-Visitor System Architecture & SSE Protocol

This document outlines the hardened event-driven architecture of the SM-Visitor system (Pantry, Orbit, Horizon). It serves as the canonical reference for future audits and production maintenance.

---

## 📡 1. Real-time SSE Pipeline (Pantry → UI)

We use **Server-Sent Events (SSE)** strictly as a **triggering mechanism**. The UI follows a "Trigger → Re-fetch" pattern to ensure absolute data consistency.

### Protocol Specification:

- **Streaming Endpoint**: `/events/stream?token=JWT`
- **Format**: Standard EventSource protocol with `id`, `event`, and `data` fields.
- **Heartbeat**: A `: keep-alive` comment is sent every 25 seconds to prevent connection timeouts.
- **Deduplication**: Every event carries a unique UUID in the `id` field. Clients must discard duplicate IDs.

### Event Catalog:

| Event Name            | Target | Purpose                                                  |
| :-------------------- | :----- | :------------------------------------------------------- |
| `NEW_VISITOR_REQUEST` | Owner  | Trigger approval UI for a new staff registration.        |
| `VISITOR_APPROVED`    | Guard  | Notify gate that staff member is now approved (show QR). |
| `visit_approved`      | Guard  | Notify gate that an entry request was approved.          |
| `new_visit_pending`   | Owner  | Trigger notification for a guest at the gate.            |

---

## 🔐 2. Identity & Context Resolution

To prevent data isolation between Guard (Orbit) and Owner (Horizon) apps, we use a centralized identity helper.

### The `get_user_id` Helper:

- **Location**: `apps/pantry/utils/auth_helpers.py`
- **Logic**: Resolves `user_id` (JWT) or `_id` (DB document) into a canonical string ID.
- **Database Resilience**: All queries use the `$in: [str, ObjectId]` operator to remain compatible with legacy records during the migration phase.

---

## 🧱 3. Data Integrity & Contract Enforcement

We use a **Strict Serialization Layer** to prevent "Contract Drift" and silent 500 errors.

- **Serializer**: `apps/pantry/services/serializers/visitor.py`
- **Rules**:
  1. Mandatory field backfilling (e.g., `created_by_role` defaults to "guard" for legacy docs).
  2. Status normalization (Uppercase `PENDING`, `APPROVED`).
  3. Type safety (Ensuring all ObjectIds are stringified before leaving the API).

---

## ⚙️ 4. Concurrency & Async Safety

FastAPI is highly efficient but vulnerable to blocking calls. We have hardened the system by:

- **Off-threading**: Using `asyncio.to_thread` for:
  - Photo Validation (Pillow CPU intensive)
  - File I/O (Disk blocking)
  - QR Rendering (CPU blocking)
- **Singleton Guard**: Frontend hooks (`useSSE`) enforce a single active connection per instance to avoid connection multiplication and UI flickers.

---

## 🔁 5. State Synchronization Model

The system uses a **Hybrid Event + Fetch** model:

1. **On Mount**: Every page fetches its own source of truth from the API.
2. **On Event**: SSE triggers a `triggerRefresh('scope')`.
3. **Refetch**: The component performs a new, signal-aware fetch.
4. **Fallback**: Hardened polling (10s) ensures UI eventually corrects even if SSE is interrupted.

---

## 🧪 6. Testing & Validation

To test the end-to-end lifecycle:

1. Open Pantry logs.
2. Register staff in Orbit. Look for `📤 [SSE] Sending 'NEW_VISITOR_REQUEST'`.
3. Open Horizon. Verify the request appears instantly.
4. Approve. Look for `📤 [SSE] Sending 'VISITOR_APPROVED'`.
5. Verify Orbit reloads automatically with the new QR code.

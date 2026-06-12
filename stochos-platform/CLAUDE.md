# Developer Guidelines & Engineering Standards

All code modifications and new feature implementations must adhere to the following validations:

## 1. Database Standards
*   **Transactional Safety**: Any multi-record write or compound operation must be wrapped in a database transaction block (e.g. Prisma `$transaction`) to ensure atomicity (all-or-nothing writes).
*   **Query Indexing**: Any field used as a high-frequency filter (e.g., status, category, date limits, deploymentType, orgUnitId, retailerId) must have a database index mapped in the schema.
*   **Relational Exclusivity**: Add constraints/guards to prevent dual-assignment conflicts (e.g. an asset cannot belong to a store and a department simultaneously).

## 2. Backend API Standards
*   **Payload Schema Validation**: All incoming requests must be validated against a strict schema (e.g. using Zod or a validation parser) before execution.
*   **Resource & Size Limiting**: Enforce strict size limits (e.g., max 5MB for file uploads) to prevent resource-exhaustion attacks.
*   **Job Concurrency Control**: Implement single-threaded locks (mutexes) for asynchronous operations or batch jobs to prevent duplicate writes or race conditions.

## 3. Frontend & UX Standards
*   **DOM Paginated Slicing**: Never render more than 100 rows in the DOM at once. Use client-side rendering pagination or server-side paging.
*   **Keystroke Debouncing**: Debounce all search input keystroke handlers (200-300ms) to prevent UI thread blocking.
*   **State Feedback**: Every button trigger or network request lasting longer than 200ms must display a loading spinner, optimistic UI update, or skeleton loader.
*   **Graceful Degradation**: When a dependency module is disabled or fails to load, the consuming component must catch the exception, render a placeholder state, or hide the integration action cleanly rather than crashing the page.

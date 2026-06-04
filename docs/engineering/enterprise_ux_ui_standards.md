# Stochos — Enterprise UX/UI & Frontend Performance Standards

This document establishes the official frontend engineering, usability, accessibility, and performance standards for the Stochos Platform. All user interface designs and client-side implementations must adhere to these guidelines to clear state procurement audits and deliver a premium experience to state lottery executives and sales representatives.

---

## 1. Tabular Data & Financial Density (Visual Alignment)

Administrative and financial platforms are built on data. The user interface must present high-density grids without causing cognitive overload.

### Standards
* **Tabular Lining for Numbers:** All numbers, currencies, coordinates, and percentages in tables must use tabular (monospaced) numerals. This guarantees that decimal points and digits align vertically, facilitating rapid visual comparison.
  * *CSS Rule:* Apply `font-feature-settings: "tnum"` or `font-variant-numeric: tabular-nums;` to tabular data.
* **Compact Padding (The 8px Grid):** Cell padding inside grids and list-items should be kept compact (vertical padding: 8px to 10px; horizontal padding: 12px) to maximize the amount of information displayed above the fold.
* **Sticky Table Headers:** Any scrollable table must lock its headers (`thead { position: sticky; top: 0; }`) so users do not lose data context while scrolling.
* **Zebra Striping & Hover Rows:** Tables must feature alternating light background colors (zebra striping) and clear highlight states on hover to guide the user's eye across wide columns.

---

## 2. Keyboard & Screen Reader Accessibility (WCAG 2.1 Level AA)

Public sector procurement (ADA, Section 508, and State Web Accessibility guidelines) mandates strict adherence to accessibility standards.

### Standards
* **Visible Focus Indicators:** Never disable the outline on focused elements (`outline: none;` is forbidden). All interactive elements must exhibit a high-contrast focus ring when focused via keyboard navigation (`:focus-visible`).
* **Keyboard Navigation:** Every button, tab, dropdown, and form input must be navigable using standard keyboard inputs (`Tab`, `Arrow Keys`, `Enter`, `Space`, `Escape`).
* **Modal Dialog Focus Traps:** When a popup dialog opens:
  1. The browser focus must immediately move inside the dialog.
  2. Focus must be trapped inside the modal (pressing `Tab` at the end of the modal loops back to the start).
  3. Pressing `Escape` must close the modal and return focus to the trigger button.
* **Semantic Structure:** Do not build click-interactive containers out of generic `<div>` or `<span>` tags. Use semantic HTML (`<button>`, `<select>`, `<input>`) or assign explicit ARIA roles (e.g., `role="button"`).

---

## 3. Interactive State Design (Micro-Feedback & Optimism)

Interfaces must feel responsive and alive, eliminating any confusion about whether an action was registered.

### Standards
* **Disable Double Submissions:** Immediately upon clicking any form submit or action button (e.g., "Calculate Optimized Sequence"), the button must transition to a disabled state and display a loading spinner. This prevents users from triggering duplicate API requests.
* **Optimistic UI Updates:** For simple, low-risk state changes (like adding a store to a route, pinning a retailer, or collapsing a sidebar), update the UI state instantly before the server API responds. If the server request fails in the background, roll back the UI and show a toast warning.
* **Skeleton Loaders:** During data fetches, avoid displaying empty pages or full-screen spinning wheels. Instead, display layout-matching, animated gray **Skeleton Components** to give users a visual preview of the incoming content.
* **Contextual Alerts:** Alerts must never rely on color alone. Use clear icons along with HSL colors (e.g., error alert = Red Border + `⚠️` icon + bold helper text).

---

## 4. Client-Side Performance & Rendering Optimization

As database query volumes scale, client-side rendering must remain smooth and responsive.

### Standards
* **Virtualized Lists for Large Datasets:** When rendering tables or lists containing more than 100 rows (such as the main Retailer Registry table), developers must use **windowed rendering** (e.g., `react-window` or `react-virtualized`). This keeps the DOM small and prevents scroll lag.
* **Input Debouncing:** Search input fields must use a **250ms debounce** delay before triggering API queries. This prevents the server from being hammered with database searches on every keystroke.
* **Client-Side Cache & Background Revalidation (SWR):** Use query fetching frameworks (like `swr` or `react-query`) that implement the `stale-while-revalidate` caching strategy:
  * Users returning to a page see cached data instantly (eliminating load screens).
  * The framework silently fetches fresh data in the background and updates the UI only if changes are detected.

---

## 5. Granular Error Resiliency & Diagnostics

A single failed component must not bring down the entire application.

### Standards
* **Granular React Error Boundaries:** The application shell must wrap separate interactive regions (e.g., the Leaflet Map Panel, the Retailer List Table, the Metrics Summary Cards) in isolated Error Boundaries. 
  * If a corrupt coordinate causes the Leaflet Map to crash, the boundaries must capture the error and display a recovery button ("Reload Map"), while the Retailer List and overall dashboard remain fully functional.
* **Actionable Error Feedback:** Avoid generic "Something went wrong" messages. Display a clear warning explaining:
  * What failed.
  * Why it failed (if known).
  * A clear action link to resolve it (e.g., "Check database connection" or "Reload page").
* **Telemetry logging:** Every captured client-side error must automatically submit a background POST request to the API logger at `/api/logs/client-error` to track issues automatically in the daily telemetry emails.

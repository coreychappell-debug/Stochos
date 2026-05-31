# Stochos: Number Format System — Engineering Implementation Plan

**Module:** Governed Grid — Number Format Subsystem  
**Version:** 1.0  
**Scope:** Cell-level number formatting for the Stochos Grid, Report Templates, and GFOA-compliant base templates

---

## 1. Overview & Design Philosophy
The Number Format System governs how numeric values are displayed across all Stochos surfaces: the Governed Analytical Worksheet (Grid), Connected Document outputs (Board Packets, ACFRs), and Published Report packages.

**Core principles:**
*   Format is a cell-level property, not a column rule, except where a column definition provides a default that individual cells may override.
*   The Metric Registry stores a canonical default format per metric. All rendering surfaces inherit from this default but may override it contextually.
*   GFOA-compliant base templates ship as locked, versioned baselines. All user-created templates are clones derived from a base template and carry fully editable format copies.
*   Format changes are auditable. Every override records who changed it, from what value, and when.
*   The system enforces WCAG 2.1 AA on all rendered outputs regardless of how a format was authored.

---

## 2. Data Model

### 2.1 `NumberFormat` Object
This is the atomic format definition. It is stored as a JSON object and referenced by cells, column definitions, and metric registry entries.

```typescript
interface NumberFormat {
  // Identity
  format_id: string;               // UUID
  label?: string;                  // Human-readable name (e.g. "ACFR Millions")
  
  // Scale
  scale: "units" | "thousands" | "millions" | "billions";
  scale_note_auto: boolean;        // If true, auto-inject "(in thousands)" into table header

  // Currency
  currency_symbol: string | null;  // "$", "€", null
  currency_position: "prefix" | "suffix";
  
  // Decimal
  decimal_places: number;          // 0–6
  
  // Thousands separator
  thousands_separator: boolean;    // true = "1,234", false = "1234"
  
  // Negative display
  negative_style: "parentheses" | "minus" | "minus_red" | "parentheses_red";
  
  // Zero display
  zero_display: "zero" | "dash" | "blank" | "zero_decimal";
  // zero_decimal = "0.0" or "0.00" honoring decimal_places
  
  // Percent
  is_percent: boolean;             // Appends % and adjusts implied scale
  
  // Sign convention
  sign_flip: boolean;              // Flip sign on display (for credit-balance metrics like Revenue)
  
  // Positional rules (for $ top/bottom accounting convention)
  positional_rules: PositionalRule[];
}

interface PositionalRule {
  position: "first_in_group" | "last_in_group" | "subtotal" | "grand_total";
  show_currency_symbol: boolean;
  show_top_border: boolean;        // Single top border (subtotals)
  show_double_bottom_border: boolean; // Double bottom border (grand totals)
}
```

### 2.2 `ColumnFormatDefinition`
When a report template defines a column, it carries a default format and a constraint mask specifying which properties individual cells may override.

```typescript
interface ColumnFormatDefinition {
  column_id: string;
  column_type: "actuals" | "budget" | "variance_dollar" | "variance_percent" 
             | "prior_year" | "ytd" | "period";
  default_format: NumberFormat;
  
  // Properties the cell-level override is NOT allowed to change
  // (Used to enforce GFOA consistency within a column group)
  locked_properties: (keyof NumberFormat)[];
  
  // For multi-period layouts: all period columns share one format definition
  // and resolve their scale/decimal from it
  period_columns_inherit: boolean;
}
```

### 2.3 `CellFormat`
Each cell in the Grid stores its own format. It is either fully specified or a delta override on top of its column definition's default.

```typescript
interface CellFormat {
  cell_id: string;
  format_override: Partial<NumberFormat>;  // Only the properties being overridden
  inherited_from: "metric_registry" | "column_default" | "explicit";
  override_author?: string;
  override_timestamp?: string;             // ISO 8601
  override_reason?: string;               // Optional audit note
}
```

### 2.4 Metric Registry Format Extension
The Metric Registry entry (already defined in the core architecture) gains a `default_format` field:

```typescript
interface MetricRegistryEntry {
  // ...existing fields...
  default_format: NumberFormat;
  format_owner: string;            // User ID of the person who owns this definition
  format_last_updated: string;
}
```

---

## 3. Format Resolution Hierarchy
When the rendering engine needs to display a cell value, it resolves format in this order:

```
1. CellFormat.format_override (if present and not locked by column)
   ↓ merge with
2. ColumnFormatDefinition.default_format
   ↓ fallback to
3. MetricRegistryEntry.default_format
   ↓ fallback to
4. System default (units, 0 decimals, parenthetical negatives, dash for zero)
```

Locked properties from `ColumnFormatDefinition.locked_properties` are never overridden by CellFormat, regardless of what is stored there. The renderer ignores them silently — no error is thrown, but no locked property is applied.

---

## 4. Column Types & Defaults
Each column type ships with an opinionated default format that the template author may adjust.

| Column Type | Default Scale | Default Negative | Default Zero | Currency Symbol | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `actuals` | inherited from metric | parentheses | dash | null (positional) | |
| `budget` | inherited from metric | parentheses | dash | null (positional) | |
| `variance_dollar` | inherited from metric | parentheses | dash | null | Favorable = positive |
| `variance_percent` | units | parentheses | dash | null | `is_percent: true` |
| `prior_year` | inherited from metric | parentheses | dash | null (positional) | |
| `ytd` | inherited from metric | parentheses | dash | null (positional) | |
| `period` | inherited from metric | parentheses | dash | null (positional) | |

Variance columns carry an additional property:

```typescript
interface VarianceColumnFormat extends ColumnFormatDefinition {
  favorable_direction: "positive" | "negative";
  // "negative" = expense variance: a negative number is favorable
  // Controls whether to apply favorable color coding
  show_favorable_color: boolean;
  favorable_color: string;     // hex, default #006400 (dark green)
  unfavorable_color: string;   // hex, default #8B0000 (dark red)
}
```

---

## 5. Positional `$` Rule Engine
This implements the accounting convention where the `$` appears on the first and last (total) row of a group, but not on interior rows.

### 5.1 Row Classification
The Grid engine classifies every row in a report section at render time:

```typescript
type RowClass = 
  | "data"           // Interior data row — no $ symbol
  | "first_in_group" // First data row of a section — $ symbol
  | "subtotal"       // Subtotal row — $ symbol, single top border
  | "grand_total"    // Grand total row — $ symbol, double bottom border
  | "header"         // Non-numeric header row — no formatting applied
  | "spacer";        // Empty row — no formatting applied
```

Row classification is defined in the template structure, not inferred automatically. Template authors assign `RowClass` when building the template. For cloned templates, row classes copy with the structure.

### 5.2 Render Logic
```
IF row.class == "data":
    render without currency symbol, no border decorations

IF row.class == "first_in_group":
    prepend currency symbol per CellFormat.currency_symbol
    no border decorations

IF row.class == "subtotal":
    prepend currency symbol
    apply single top border to cell

IF row.class == "grand_total":
    prepend currency symbol
    apply double bottom border to cell
```
The currency symbol is never shown on interior data rows regardless of what the CellFormat specifies. The positional rule always wins.

---

## 6. Rounding Rollup Validation
When a column uses `scale: "thousands"` or `"millions"` with `decimal_places: 0`, individual rounded values may not sum to the rounded total. The system detects and flags this.

### 6.1 Validation Rule
After rendering any column that contains a subtotal or grand total row:

```
raw_sum = SUM of unrounded cell values in the group
rendered_sum = SUM of individually rounded cell values
rendered_total = rounded value of the total row

IF rendered_sum != rendered_total:
    flag the total cell with a rollup_discrepancy warning
```

### 6.2 Warning Behavior
*   A small indicator icon appears on the flagged total cell in the Grid view.
*   Hovering/clicking the indicator shows: `"Rounding discrepancy: Displayed values sum to [X] but total rounds to [Y]. Difference: [Z]."`
*   The discrepancy is not auto-corrected. The user may resolve by increasing decimal places, or by explicitly marking the total cell as `override_rounding: true` which suppresses the warning and adds an audit note.
*   Discrepancy warnings are excluded from published outputs (Board Packets, PDF) unless the author explicitly includes them as footnotes.
*   The warning state is stored in the cell's metadata and included in the audit trail.

---

## 7. Multi-Period Layout Format Handling
Multi-period layouts (e.g., 12 months + YTD across a single sheet) have a single `ColumnFormatDefinition` shared by all period columns.

### 7.1 Period Column Group
```typescript
interface PeriodColumnGroup {
  group_id: string;
  period_count: number;            // e.g., 12 for monthly, 4 for quarterly
  include_ytd_column: boolean;
  shared_format: ColumnFormatDefinition;
  // Individual period columns may override only unlocked properties
  period_overrides: Record<string, Partial<NumberFormat>>; 
  // key = period_column_id, value = override delta
}
```

### 7.2 YTD Column
The YTD column inherits from `shared_format` but has its own `ColumnFormatDefinition` instance. By default it is a copy of the period column format. Template authors may lock it to always match the period format.

---

## 8. Template System

### 8.1 Base Templates
Stochos ships with the following locked base templates. These cannot be edited by any user, including administrators.

| Template ID | Name | GFOA Standard | Period |
| :--- | :--- | :--- | :--- |
| `BASE_ACFR_GOV_WIDE` | ACFR Government-Wide Statement | GASB 34 | Annual |
| `BASE_ACFR_FUND` | ACFR Fund Financial Statements | GASB 34 | Annual |
| `BASE_BUDGET_ADOPTION` | GFOA Budget Adoption Document | GFOA Budget Award | Annual |
| `BASE_BUDGET_TO_ACTUAL` | Budget-to-Actual Comparison | GFOA | Annual/Quarterly |
| `BASE_QUARTERLY_FINANCIAL`| Quarterly Financial Statement | Internal | Quarterly |
| `BASE_MONTHLY_BA` | Monthly Budget-to-Actual | Internal | Monthly |

Each base template includes:
*   Full column structure with `ColumnFormatDefinition` for every column
*   Row class assignments for all structural rows
*   Pre-configured `PositionalRule` arrays
*   Metric Registry bindings for all standard lottery metrics
*   Scale notes auto-configured per GFOA convention

### 8.2 Template Cloning
```typescript
interface CloneTemplateRequest {
  source_template_id: string;      // Can be a base template or another user template
  new_name: string;
  new_description?: string;
  organization_id: string;
}

interface TemplateCloneResult {
  new_template_id: string;
  cloned_from: string;
  cloned_at: string;               // ISO 8601
  cloned_by: string;               // User ID
  is_base_template: false;         // Clones are never base templates
}
```

Cloning behavior:
*   All `ColumnFormatDefinition` objects are deep-copied as new independent records. No reference to the source template's format definitions is retained.
*   All row class assignments and positional rules are copied.
*   Metric Registry bindings are copied by reference (metric definitions are shared, not cloned).
*   The clone's `locked_properties` arrays are preserved from the source but are fully editable on the clone.

### 8.3 Template Versioning
Templates use integer versioning. Every save increments the version. Prior versions are retained indefinitely for audit purposes. Published reports store the `template_id` + `template_version` at the time of publication — the report will always re-render identically against that snapshot.

```typescript
interface TemplateVersion {
  template_id: string;
  version: number;
  saved_at: string;
  saved_by: string;
  change_summary?: string;         // Optional user-provided note
  snapshot: TemplateDefinition;    // Full serialized template at this version
}
```

---

## 9. Format Panel UI Specification
This section describes the format panel UI that appears when a user selects a cell or column header and opens the format controls. Engineering should implement this as a right-side panel or modal, consistent with the application's existing component patterns.

### 9.1 Panel Sections
The panel is organized into collapsible sections. Defaults shown are for an `actuals` column in a lottery financial statement.

**Section 1: Scale**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Display Scale | Radio group | Units, Thousands (K), Millions (M), Billions (B) | Millions |
| Auto-inject scale note into header | Toggle | On/Off | On |

**Section 2: Currency**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Currency Symbol | Text input (max 3 chars) | Free text | $ |
| Position | Radio | Before number, After number | Before |
| Show symbol on this cell | Read-only display | "Controlled by row position rule" or "Always / Never" | Position rule |
> Note: When a cell is governed by a positional rule, the "Show symbol" control is replaced by a non-editable label explaining the rule. Engineers must not allow this field to be edited in that state.

**Section 3: Decimal Places**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Decimal Places | Stepper (0–6) | Integer | 0 |
| Preview | Read-only | Live-rendered example | e.g., "1,234" |

**Section 4: Negative Numbers**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Negative Display | Radio group | (1,234) — parentheses; -1,234 — minus; (1,234) red; -1,234 red | Parentheses |

**Section 5: Zero Display**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Display zero as | Radio group | — dash, 0 zero, [blank] blank, 0.0 decimal | Dash |

**Section 6: Sign Convention**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Flip display sign | Toggle | On/Off | Off |
| Explanation tooltip | Info icon | "Flip sign flips positive to negative and vice versa on display only. Source data is not affected. Used for revenue accounts that carry a natural credit balance." | — |

**Section 7: Percent**
| Control | Type | Options | Default |
| :--- | :--- | :--- | :--- |
| Display as percent | Toggle | On/Off | Off |
| Note (shown when on) | Static text | "Appends % symbol. Value is assumed to already be in percent form (e.g., 62.5 displays as 62.5%)." | — |

**Section 8: Positional Rules (Column-level only, not cell-level)**
This section is only visible when the user is editing a column definition, not an individual cell.
| Control | Type | Default |
| :--- | :--- | :--- |
| First row in group shows $ | Toggle | On |
| Subtotal rows show $ | Toggle | On |
| Grand total rows show $ | Toggle | On |
| Subtotal rows show single top border | Toggle | On |
| Grand total rows show double bottom border | Toggle | On |

**Section 9: Live Preview**
A non-editable preview row at the bottom of the panel showing the same number rendered in three states:
| Scenario | Example |
| :--- | :--- |
| Positive value | $ 1,234 |
| Negative value | $ (1,234) |
| Zero value | — |
| Grand total row | $ 1,234 (with double underline) |
The preview updates in real time as any control changes.

**Section 10: Variance Column Extras (only shown for variance column types)**
| Control | Type | Default |
| :--- | :--- | :--- |
| Favorable direction | Radio | Positive is favorable / Negative is favorable |
| Show favorable/unfavorable color coding | Toggle | On |
| Favorable color | Color picker | #006400 |
| Unfavorable color | Color picker | #8B0000 |

### 9.2 Locked Property Behavior
When a property is locked at the column level and the user is editing a cell within that column:
*   The locked control is rendered in a disabled/greyed state.
*   A lock icon appears next to the label.
*   A tooltip on hover reads: `"This property is set at the column level and cannot be overridden on individual cells."`
*   Engineers must enforce this constraint server-side as well — a `CellFormat` submitted with an override on a locked property is rejected with a `400` error and a descriptive message.

---

## 10. Format Presets
Presets allow users to save and reuse a named `NumberFormat` configuration across their organization.

```typescript
interface FormatPreset {
  preset_id: string;
  name: string;                    // e.g., "ACFR Millions Standard"
  description?: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  format: NumberFormat;
  is_system_preset: boolean;       // true = ships with Stochos, not editable
}
```

### 10.1 System Presets (ship with Stochos)
| Preset Name | Scale | Decimal | Negative | Zero | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ACFR Government-Wide | Millions | 1 | Parentheses | Dash | GASB 34 standard |
| ACFR Fund-Level | Thousands | 0 | Parentheses | Dash | GASB 34 standard |
| Budget Presentation | Thousands | 0 | Parentheses | Dash | GFOA Budget Award |
| Operational Dashboard | Units | 0 | Minus | Zero | Internal ops use |
| Percent Standard | Units | 1 | Parentheses | Dash | `is_percent: true` |
| Prize Payout Rate | Units | 2 | Parentheses | Dash | `is_percent: true` |

### 10.2 Preset Application
Applying a preset to a cell or column populates all `NumberFormat` fields from the preset. The preset itself is not linked after application — it is a one-time copy. Subsequent changes to a preset do not propagate to cells where it was previously applied.

---

## 11. Accessibility Requirements
All formatted number outputs must comply with WCAG 2.1 AA. The following requirements apply to the rendering layer:

### 11.1 `aria-label` on Numeric Cells
Every numeric cell in a rendered Grid or exported HTML document must include an `aria-label` expressing the full unabbreviated value:
```html
<!-- Displayed: (1.2) -->
<!-- Scale: Millions, Negative: Parentheses -->
<td 
  aria-label="Negative one million two hundred thousand dollars"
  class="stochos-cell stochos-cell--negative"
>
  (1.2)
</td>
```
The `aria-label` generation function must:
*   Expand scale (`M` → "million", `K` → "thousand")
*   Expand currency symbol (`$` → "dollars", `€` → "euros", or the verbatim symbol if unrecognized)
*   Express negatives as "negative" not "minus" or "parenthetical"
*   Express zero per `zero_display` setting: dash cells read as "zero" to screen readers regardless of visual display

### 11.2 Color as Non-Sole Indicator
Favorable/unfavorable color coding on variance columns must never be the sole indicator. An accessible alternative must be present:
*   Option A: Append `(F)` / `(U)` as visually hidden `<span class="sr-only">` text within the cell
*   Option B: Use a standard accounting parenthesis for unfavorable regardless of color setting
Engineers must implement Option A at minimum. Option B may be combined with it.

### 11.3 Border Rendering
Double bottom borders on grand total rows must not rely solely on visual CSS. The row must also carry `role="row"` with `aria-label="Grand total"` or equivalent on the row element.

---

## 12. API Endpoints

### 12.1 Format Management
```
GET    /api/v1/formats/presets                     List all system + org presets
POST   /api/v1/formats/presets                     Create org preset
GET    /api/v1/formats/presets/:preset_id          Get single preset

GET    /api/v1/grids/:grid_id/cells/:cell_id/format   Get cell format
PUT    /api/v1/grids/:grid_id/cells/:cell_id/format   Update cell format (validates against locked props)
DELETE /api/v1/grids/:grid_id/cells/:cell_id/format   Reset cell to column/registry default

GET    /api/v1/templates/:template_id/columns/:col_id/format   Get column format definition
PUT    /api/v1/templates/:template_id/columns/:col_id/format   Update column format (non-base templates only)
```

### 12.2 Validation Endpoint
```
POST   /api/v1/formats/validate
```
Request body: `{ format: NumberFormat, sample_values: number[] }`  
Response: `{ rendered: string[], warnings: RollupWarning[] }`  
Used by the Live Preview in the format panel to render examples without committing any changes.

### 12.3 Rollup Discrepancy
```
GET    /api/v1/grids/:grid_id/rollup-discrepancies
```
Returns all cells in the grid currently flagged with rounding discrepancies. Used to populate a discrepancy summary panel.

---

## 13. Audit Trail
Every format change is logged to the `format_audit_log` table:

```typescript
interface FormatAuditEntry {
  entry_id: string;
  entity_type: "cell" | "column" | "metric_registry" | "template";
  entity_id: string;
  changed_by: string;              // User ID
  changed_at: string;              // ISO 8601
  previous_format: Partial<NumberFormat>;
  new_format: Partial<NumberFormat>;
  reason?: string;                 // User-supplied note
  source: "manual" | "preset_apply" | "template_clone" | "system_default";
}
```
Audit logs are append-only. No entry may be modified or deleted. Audit log access requires the `format:audit:read` permission.

---

## 14. Permissions Model
| Action | Required Permission |
| :--- | :--- |
| View format on any cell | `grid:read` |
| Override cell format | `grid:format:write` |
| Edit column format definition on a template | `template:format:write` |
| Edit metric registry default format | `registry:format:write` |
| Create/edit org format presets | `format:preset:write` |
| View audit log | `format:audit:read` |
| Override locked column properties (admin only) | `format:locked:override` — separate permission, not bundled with any standard role |

Base template format definitions are immutable for all users including system administrators. Modifications require a Stochos platform release.

---

## 15. Out of Scope for v1
The following are noted for future versions and should not be engineered now:
*   Conditional formatting rules (e.g., IF variance > 10% THEN highlight red) — this belongs to the Commentary Rules Engine in v1 and may extend to cell formatting in v2.
*   Per-cell font, size, or color overrides beyond the favorable/unfavorable variance color scheme.
*   Custom number format strings (Excel-style format codes like `#,##0.0;(#,##0.0)`). The structured format object is the abstraction layer — raw format strings are not exposed to users in v1.
*   Locale-specific format variants (e.g., European comma-decimal). All v1 outputs are US locale.

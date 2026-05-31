// =============================================================================
// Stochos Platform — Number Format System Interfaces
// =============================================================================
// This defines the strict typing for the Number Format Subsystem as outlined
// in the engineering specification.

export interface PositionalRule {
  position: "first_in_group" | "last_in_group" | "subtotal" | "grand_total";
  show_currency_symbol: boolean;
  show_top_border: boolean;
  show_double_bottom_border: boolean;
}

export interface NumberFormat {
  format_id: string;               // UUID
  label?: string;                  // Human-readable name (e.g. "ACFR Millions")
  
  scale: "units" | "thousands" | "millions" | "billions";
  scale_note_auto: boolean;        // If true, auto-inject "(in thousands)"
  
  currency_symbol: string | null;  // "$", "€", null
  currency_position: "prefix" | "suffix";
  
  decimal_places: number;          // 0-6
  thousands_separator: boolean;    
  
  negative_style: "parentheses" | "minus" | "minus_red" | "parentheses_red";
  zero_display: "zero" | "dash" | "blank" | "zero_decimal";
  
  is_percent: boolean;
  sign_flip: boolean;
  
  positional_rules: PositionalRule[];
}

export interface ColumnFormatDefinition {
  column_id: string;
  column_type: "actuals" | "budget" | "variance_dollar" | "variance_percent" | "prior_year" | "ytd" | "period";
  default_format: NumberFormat;
  locked_properties: Array<keyof NumberFormat>;
  period_columns_inherit: boolean;
}

export interface VarianceColumnFormat extends ColumnFormatDefinition {
  favorable_direction: "positive" | "negative";
  show_favorable_color: boolean;
  favorable_color: string;
  unfavorable_color: string;
}

export interface CellFormat {
  cell_id: string;
  format_override: Partial<NumberFormat>;
  inherited_from: "metric_registry" | "column_default" | "explicit";
  override_author?: string;
  override_timestamp?: string; // ISO 8601
  override_reason?: string;
}

export interface PeriodColumnGroup {
  group_id: string;
  period_count: number;
  include_ytd_column: boolean;
  shared_format: ColumnFormatDefinition;
  period_overrides: Record<string, Partial<NumberFormat>>;
}

export type RowClass = 
  | "data" 
  | "first_in_group" 
  | "subtotal" 
  | "grand_total" 
  | "header" 
  | "spacer";

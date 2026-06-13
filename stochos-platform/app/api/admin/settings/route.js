import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "system_settings.json");
const LICENSE_LIMITS_PATH = path.join(process.cwd(), "data", "license_limits.json");

async function readSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    // Default fallback features
    return {
      feature_organization: true,
      feature_analytics_overview: true,
      feature_analytics_retailers: true,
      feature_analytics_portfolio: true,
      feature_reporting: true,
      feature_reporting_prep: true,
      feature_reporting_grid: true,
      feature_reporting_workflow: true,
      feature_budgeting: true,
      feature_analytics_geography: true,
      feature_analytics_forecast: true,
      feature_marketing: true,
      feature_instant_tickets: true,
      feature_draw_planning: true,
      feature_products: true,
      feature_fomo: true,
      feature_contracts: true,
      feature_fleet: true,
      feature_vendors: true,
      feature_spatial_ops: true,
      feature_assets: true,
    };
  }
}

async function readLicenseLimits() {
  try {
    const data = await fs.readFile(LICENSE_LIMITS_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return parsed.licensed_features || [];
  } catch (err) {
    // Fallback: if file doesn't exist, allow all features by default for backwards compatibility
    return [
      "feature_organization",
      "feature_analytics_overview",
      "feature_analytics_retailers",
      "feature_analytics_portfolio",
      "feature_reporting",
      "feature_reporting_prep",
      "feature_reporting_grid",
      "feature_reporting_workflow",
      "feature_budgeting",
      "feature_analytics_geography",
      "feature_analytics_forecast",
      "feature_marketing",
      "feature_instant_tickets",
      "feature_draw_planning",
      "feature_products",
      "feature_fomo",
      "feature_contracts",
      "feature_fleet",
      "feature_vendors",
      "feature_spatial_ops",
      "feature_assets"
    ];
  }
}

export async function GET(request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const features = await readSettings();
  const licensed = await readLicenseLimits();
  return NextResponse.json({ success: true, features, licensed });
}

export async function POST(request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Restrict updating settings strictly to the Admin role
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Read current settings and license boundaries to merge/validate keys
    const current = await readSettings();
    const licensed = await readLicenseLimits();
    const updated = { ...current };

    // Update settings using Zod-like validation for boolean values
    for (const [key, val] of Object.entries(body)) {
      if (key in current) {
        if (typeof val === "boolean") {
          // Reject attempts to activate unlicensed modules
          if (val === true && !licensed.includes(key)) {
            return NextResponse.json(
              { error: `Cannot activate '${key}': This module is not licensed under your current contract.` },
              { status: 400 }
            );
          }
          updated[key] = val;
        } else {
          return NextResponse.json({ error: `Invalid value type for key '${key}'. Expected boolean.` }, { status: 400 });
        }
      }
    }

    // Ensure the data directory exists
    await fs.mkdir(path.dirname(SETTINGS_FILE_PATH), { recursive: true });

    // Write updated settings back to system_settings.json
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");

    return NextResponse.json({ success: true, features: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


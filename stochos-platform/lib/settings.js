import fs from "fs/promises";
import path from "path";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "system_settings.json");

export async function getFeatureFlag(key) {
  try {
    const data = await fs.readFile(SETTINGS_FILE_PATH, "utf-8");
    const json = JSON.parse(data);
    return json[key] !== false;
  } catch (err) {
    return true; // Default fallback is enabled
  }
}

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/reporting/upload/';
const PIPELINES_URL = 'http://localhost:3000/api/reporting/pipelines/';
const FILES_DIR = "c:\\Users\\corey\\Downloads\\Corey - Code Stuff\\R Server Project folder\\New York Scripts and Process\\synthetic_trial_balances";

// Helper to map period index to calendar date string (matching resolution in UploadClient.js)
function getPeriodDate(year, code) {
  const periodMonthMap = {
    P01: { month: 3, day: 30 }, // April
    P02: { month: 4, day: 31 }, // May
    P03: { month: 5, day: 30 }, // June
    P04: { month: 6, day: 31 }, // July
    P05: { month: 7, day: 31 }, // August
    P06: { month: 8, day: 30 }, // September
    P07: { month: 9, day: 31 }, // October
    P08: { month: 10, day: 30 }, // November
    P09: { month: 11, day: 31 }, // December
    P10: { month: 0, day: 31 }, // January
    P11: { month: 1, day: 28 }, // February
    P12: { month: 2, day: 31 }, // March
    P13: { month: 2, day: 31 }  // EOY Adjustments (Annual)
  };
  const mapped = periodMonthMap[code] || { month: 5, day: 30 };
  const dateYear = ['P10', 'P11', 'P12', 'P13'].includes(code) ? year : year - 1;
  
  // Format as UTC ISO string date portion
  const date = new Date(Date.UTC(dateYear, mapped.month, mapped.day));
  return date.toISOString().split('T')[0];
}

async function uploadFile(year, periodCode, dateStr, filepath, pipelineId) {
  try {
    if (!fs.existsSync(filepath)) {
      console.error(`File not found: ${filepath}`);
      return false;
    }
    
    const fileBuffer = fs.readFileSync(filepath);
    const fileBlob = new Blob([fileBuffer], { type: 'text/csv' });
    
    const formData = new FormData();
    formData.append('file', fileBlob, path.basename(filepath));
    formData.append('jurisdictionId', 'NY-LOTTERY');
    formData.append('periodDate', dateStr);
    formData.append('fiscalYear', String(year));
    formData.append('periodCode', periodCode);
    formData.append('pipelineId', pipelineId);
    
    console.log(`Uploading ${path.basename(filepath)} | Period: ${periodCode} | Date: ${dateStr} | FY: ${year}...`);
    
    const res = await fetch(API_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'x-simulated-test': 'true'
      }
    });
    
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse API response JSON: ${text}`);
      return false;
    }
    
    if (res.status === 200 && json.success) {
      console.log(`✓ Success: Mapped ${json.count} rows. Validation: ${json.validationStatus}`);
      return true;
    } else {
      console.error(`✗ Error (Status ${res.status}):`, json.error || json);
      return false;
    }
  } catch (error) {
    console.error(`✗ Exception during upload of ${path.basename(filepath)}:`, error);
    return false;
  }
}

async function main() {
  console.log("=== STARTING PROGRAMMATIC INGESTION ===");
  console.log(`Reading from: ${FILES_DIR}`);
  
  // 1. Fetch pipelines and get first ID
  console.log("Fetching available pipelines...");
  const pipeRes = await fetch(PIPELINES_URL, {
    headers: { 'x-simulated-test': 'true' }
  });
  const pipeJson = await pipeRes.json();
  const pipelines = pipeJson.pipelines || [];
  if (pipelines.length === 0) {
    console.error("No pipelines found in database! Please seed or create a pipeline first.");
    return;
  }
  const pipelineId = pipelines[0].id;
  console.log(`Using pipeline: "${pipelines[0].name}" (ID: ${pipelineId})\n`);
  
  const tasks = [];
  
  // 2. FY 2023 Monthly (P01 - P12) & Annual (P13)
  for (let i = 1; i <= 12; i++) {
    const pCode = `P${String(i).padStart(2, '0')}`;
    const filename = `ny_tb_fy2023_p${String(i).padStart(2, '0')}.csv`;
    tasks.push({ year: 2023, code: pCode, file: filename });
  }
  tasks.push({ year: 2023, code: 'P13', file: 'ny_tb_fy2023_annual.csv' });
  
  // 3. FY 2024 Monthly (P01 - P12) & Annual (P13)
  for (let i = 1; i <= 12; i++) {
    const pCode = `P${String(i).padStart(2, '0')}`;
    const filename = `ny_tb_fy2024_p${String(i).padStart(2, '0')}.csv`;
    tasks.push({ year: 2024, code: pCode, file: filename });
  }
  tasks.push({ year: 2024, code: 'P13', file: 'ny_tb_fy2024_annual.csv' });
  
  let successCount = 0;
  for (const t of tasks) {
    const dateStr = getPeriodDate(t.year, t.code);
    const filepath = path.join(FILES_DIR, t.file);
    const ok = await uploadFile(t.year, t.code, dateStr, filepath, pipelineId);
    if (ok) successCount++;
    // Small timeout to prevent DB overload / race conditions
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n=== INGESTION SUMMARY ===`);
  console.log(`Successfully imported ${successCount} / ${tasks.length} periods.`);
}

main().catch(console.error);

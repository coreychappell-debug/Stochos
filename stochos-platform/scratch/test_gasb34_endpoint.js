const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:3000/api/reporting/gasb34';

async function testEndpoint(year, periodCode) {
  try {
    const url = `${API_BASE}?jurisdictionId=NY-LOTTERY&fiscalYear=${year}&periodCode=${periodCode}`;
    console.log(`Querying: ${url}`);
    const res = await fetch(url, {
      headers: {
        'x-simulated-test': 'true'
      }
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse response: ${text}`);
      return false;
    }

    if (res.status === 200 && json.success) {
      console.log(`✓ Success! isBalanced: ${json.isBalanced}, Discrepancy: $${json.discrepancy?.toFixed(2)}`);
      console.log(`  Net Position rows count: ${json.netPositionRows?.length}`);
      console.log(`  Revenues/Expenses rows count: ${json.revenuesExpensesRows?.length}`);
      return true;
    } else {
      console.error(`✗ Error (Status ${res.status}):`, json.error || json);
      return false;
    }
  } catch (err) {
    console.error(`✗ Exception for FY${year} ${periodCode}:`, err);
    return false;
  }
}

async function main() {
  console.log("=== Testing GASB 34 Report Compilation Endpoint ===");
  
  // Test FY 2024 P12 (which we ingested)
  const ok1 = await testEndpoint(2024, 'P12');
  
  // Test FY 2023 P06 (which we ingested)
  const ok2 = await testEndpoint(2023, 'P06');

  // Test FY 2024 P13 (EOY adjusted)
  const ok3 = await testEndpoint(2024, 'P13');

  // Test FY 2025 P12 (which was pre-seeded)
  const ok4 = await testEndpoint(2025, 'P12');

  const allOk = ok1 && ok2 && ok3 && ok4;
  console.log(`\nCompilation test results: ${allOk ? 'ALL PASSED' : 'SOME FAILED'}`);
}

main().catch(console.error);

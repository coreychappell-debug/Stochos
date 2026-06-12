const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/reporting/upload/';
const PIPELINES_URL = 'http://localhost:3000/api/reporting/pipelines/';
const filepath = "c:\\Users\\corey\\Downloads\\Corey - Code Stuff\\R Server Project folder\\New York Scripts and Process\\synthetic_trial_balances\\ny_tb_fy2023_p01.csv";

async function main() {
  // 1. Fetch pipelines and get first ID
  const pipeRes = await fetch(PIPELINES_URL, {
    headers: { 'x-simulated-test': 'true' }
  });
  const pipeJson = await pipeRes.json();
  const pipelines = pipeJson.pipelines || [];
  if (pipelines.length === 0) {
    console.error("No pipelines found in database!");
    return;
  }
  const pipelineId = pipelines[0].id;
  console.log("Found pipeline ID:", pipelineId);

  // 2. Perform upload
  const fileBuffer = fs.readFileSync(filepath);
  const fileBlob = new Blob([fileBuffer], { type: 'text/csv' });
  
  const formData = new FormData();
  formData.append('file', fileBlob, path.basename(filepath));
  formData.append('jurisdictionId', 'NY-LOTTERY');
  formData.append('periodDate', '2022-04-30');
  formData.append('fiscalYear', '2023');
  formData.append('periodCode', 'P01');
  formData.append('pipelineId', pipelineId);
  
  const res = await fetch(API_URL, {
    method: 'POST',
    body: formData,
    headers: {
      'x-simulated-test': 'true'
    }
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response text:", text);
}

main().catch(console.error);

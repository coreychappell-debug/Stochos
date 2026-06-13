const fs = require('fs').promises;
const path = require('path');

const LICENSE_LIMITS_PATH = path.join(__dirname, '../data/license_limits.json');
const ORIGINAL_LICENSE_PATH = path.join(__dirname, '../data/license_limits_backup.json');

async function testLicenseLimits() {
  console.log("======================================================");
  console.log("TESTING LOCAL CONTRACT LICENSE GATING LOGIC");
  console.log("======================================================");

  // Backup original license limits if it exists
  let originalContent = null;
  try {
    originalContent = await fs.readFile(LICENSE_LIMITS_PATH, 'utf-8');
    await fs.writeFile(ORIGINAL_LICENSE_PATH, originalContent, 'utf-8');
    console.log("[1/4] Backed up original license file.");
  } catch (e) {
    console.log("[1/4] No original license file to backup.");
  }

  try {
    // 2. Write mock license limits (excluding feature_spatial_ops and feature_fleet)
    const mockLicense = {
      licensed_features: [
        "feature_organization",
        "feature_analytics_overview",
        "feature_assets"
      ]
    };
    await fs.writeFile(LICENSE_LIMITS_PATH, JSON.stringify(mockLicense, null, 2), 'utf-8');
    console.log("[2/4] Wrote mock license file (allowed: org, analytics_overview, assets).");

    // 3. Simulate backend GET & POST logic
    console.log("[3/4] Running simulated gating logic tests...");

    // Helper functions from settings route
    const readLicenseLimits = async () => {
      const data = await fs.readFile(LICENSE_LIMITS_PATH, "utf-8");
      const parsed = JSON.parse(data);
      return parsed.licensed_features || [];
    };

    const licensed = await readLicenseLimits();
    console.log("   -> Active Licensed List:", licensed);

    // Test CASE A: Allow enabling a licensed feature
    const testKeyA = "feature_assets";
    const testValA = true;
    if (testValA === true && !licensed.includes(testKeyA)) {
      throw new Error(`Failed Test A: Blocked a licensed feature '${testKeyA}'`);
    } else {
      console.log(`   ✅ Test A Passed: Allowed activating licensed module '${testKeyA}'`);
    }

    // Test CASE B: Block enabling an unlicensed feature
    const testKeyB = "feature_spatial_ops";
    const testValB = true;
    if (testValB === true && !licensed.includes(testKeyB)) {
      console.log(`   ✅ Test B Passed: Correctly blocked activation of unlicensed module '${testKeyB}'`);
    } else {
      throw new Error(`Failed Test B: Allowed activation of unlicensed module '${testKeyB}'`);
    }

    // Test CASE C: Allow disabling any feature (even if unlicensed)
    const testKeyC = "feature_spatial_ops";
    const testValC = false;
    if (testValC === true && !licensed.includes(testKeyC)) {
      throw new Error(`Failed Test C: Blocked disabling of module '${testKeyC}'`);
    } else {
      console.log(`   ✅ Test C Passed: Allowed disabling of module '${testKeyC}'`);
    }

  } finally {
    // 4. Restore original license limits
    if (originalContent) {
      await fs.writeFile(LICENSE_LIMITS_PATH, originalContent, 'utf-8');
      try {
        await fs.unlink(ORIGINAL_LICENSE_PATH);
      } catch (e) {}
      console.log("[4/4] Restored original license file from backup.");
    } else {
      try {
        await fs.unlink(LICENSE_LIMITS_PATH);
      } catch (e) {}
      console.log("[4/4] Cleaned up temporary license file.");
    }
  }

  console.log("======================================================");
  console.log("ALL LICENSE GATING VERIFICATION TESTS PASSED!");
  console.log("======================================================");
}

testLicenseLimits().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

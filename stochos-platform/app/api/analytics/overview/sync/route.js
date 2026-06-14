import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function POST() {
  try {
    // Trigger the python sync script running inside WSL
    const command = 'wsl -d Ubuntu-22.04 -u root python3 "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/jobs/sync_exec_marts.py"';
    const { stdout, stderr } = await execPromise(command);
    
    console.log("Sync output:", stdout);
    if (stderr) {
      console.warn("Sync warning/stderr:", stderr);
    }

    return NextResponse.json({
      success: true,
      message: "Database synchronization completed successfully.",
      log: stdout
    });
  } catch (error) {
    console.error("Synchronization failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

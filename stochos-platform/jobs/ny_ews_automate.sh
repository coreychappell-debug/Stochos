#!/bin/bash
# ==============================================================================
# SCRIPT: ny_ews_automate.sh
# PURPOSE: Orchestrates the NY EWS pipeline on Ubuntu.
#          Designed to be executed via a cron job (e.g., every 15 minutes).
# ==============================================================================

set -e

# Change directory to the jobs directory
cd "/srv/stochos/jobs"

echo "====================================================="
echo "Starting New York Lottery Early Warning System Pipeline"
echo "Time: $(date)"
echo "====================================================="

RSCRIPT_BIN=$(which Rscript || echo "/usr/bin/Rscript")

# Step 1: Ingest Live Emergencies
echo "Executing Phase 1: Ingesting Emergencies..."
$RSCRIPT_BIN ny_ews_ingest.R

# Step 2: Run Spatial Risk Math
echo "Executing Phase 2: Spatial Risk Engine..."
$RSCRIPT_BIN ny_ews_risk_logic.R

echo "====================================================="
echo "Pipeline Completed Successfully!"
echo "Time: $(date)"
echo "====================================================="

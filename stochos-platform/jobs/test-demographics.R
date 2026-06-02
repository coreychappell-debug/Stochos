library(DBI)
library(duckdb)

db_path <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
con <- dbConnect(duckdb(), db_path, read_only = TRUE)
on.exit(dbDisconnect(con))

cat("=== Starting Demographics & Regional Mart Verification ===\n\n")

# 1. Check ny_county_demographics_dim
demographics_count <- dbGetQuery(con, "SELECT COUNT(*) AS count FROM ny_county_demographics_dim")$count[1]
cat("1. ny_county_demographics_dim row count: ", demographics_count, " (Expected: 62)\n")
stopifnot(demographics_count == 62)

# 2. Check ny_county_regions_dim
regions_count <- dbGetQuery(con, "SELECT COUNT(*) AS count FROM ny_county_regions_dim")$count[1]
cat("2. ny_county_regions_dim row count: ", regions_count, " (Expected: 62)\n")
stopifnot(regions_count == 62)

# 3. Check mart_ny_county_summary metrics
county_summary <- dbGetQuery(con, "SELECT * FROM mart_ny_county_summary WHERE county != 'Unknown'")
cat("3. mart_ny_county_summary row count: ", nrow(county_summary), "\n")

# Check for NULLs or divide-by-zero in per-capita fields
null_capita <- sum(is.na(county_summary$sales_per_capita))
inf_capita <- sum(is.infinite(county_summary$sales_per_capita))
cat("   - Missing sales per capita count: ", null_capita, " (Expected: 0)\n")
cat("   - Infinite sales per capita count: ", inf_capita, " (Expected: 0)\n")
stopifnot(null_capita == 0 && inf_capita == 0)

# Check for LMR assignment coverage
unassigned_counties <- sum(is.na(county_summary$region))
cat("   - Counties missing region assignments: ", unassigned_counties, " (Expected: 0)\n")
stopifnot(unassigned_counties == 0)

cat("\n=== All Tests Passed Successfully! ===\n")

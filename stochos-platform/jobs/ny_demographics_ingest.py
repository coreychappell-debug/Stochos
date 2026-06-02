#!/usr/bin/env python3
import urllib.request
import csv
import json
import duckdb
import sys
import os

db_path = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
csv_url = "https://corgis-edu.github.io/corgis/datasets/csv/county_demographics/county_demographics.csv"

# Env paths matching status_reporter.py
ENV_PATHS = [
    "./.env.local",
    "./.env",
    "../.env.local",
    "../.env",
    "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env.local",
    "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env",
    "/srv/stochos/analyst_lab/stochos-platform/.env.local",
    "/srv/stochos/analyst_lab/stochos-platform/.env"
]

def load_dotenv():
    """Load environment variables from env files without external dependencies."""
    loaded = False
    for path in ENV_PATHS:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip().strip('"').strip("'")
                        os.environ[key] = val
            print(f"Loaded configuration from: {path}")
            loaded = True
            break
    return loaded

def main():
    load_dotenv()
    census_key = os.environ.get("CENSUS_API_KEY")

    print(f"Connecting to DuckDB at {db_path}...")
    try:
        con = duckdb.connect(db_path)
    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        sys.exit(1)

    print("Recreating table ny_county_demographics_dim...")
    con.execute("DROP TABLE IF EXISTS ny_county_demographics_dim;")
    con.execute("""
        CREATE TABLE ny_county_demographics_dim (
            county VARCHAR,
            population INTEGER,
            land_area DOUBLE,
            median_income DOUBLE,
            data_year INTEGER,
            PRIMARY KEY (county, data_year)
        );
    """)

    print(f"Downloading CORGIS county demographics CSV from {csv_url}...")
    req = urllib.request.Request(csv_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            lines = [line.decode('utf-8') for line in response.read().splitlines()]
    except Exception as e:
        print(f"Error downloading CORGIS CSV: {e}", file=sys.stderr)
        sys.exit(1)

    # Build land area lookup map
    reader = csv.reader(lines)
    header = next(reader)

    county_idx = -1
    state_idx = -1
    area_idx = -1
    # We will also use these for the 2020 CORGIS fallback if needed
    income_idx = -1
    pop_idx = -1

    for i, col in enumerate(header):
        if col == "County":
            county_idx = i
        elif col == "State":
            state_idx = i
        elif col == "Income.Median Houseold Income":
            income_idx = i
        elif col == "Miscellaneous.Land Area":
            area_idx = i
        elif col == "Population.2020 Population":
            pop_idx = i

    if -1 in (county_idx, state_idx, area_idx):
        print(f"Error: Required columns missing in CORGIS CSV. Headers: {header}", file=sys.stderr)
        sys.exit(1)

    land_areas = {}
    corgis_rows = list(reader)
    for row in corgis_rows:
        if row[state_idx].strip() == "NY":
            raw_county = row[county_idx].strip()
            cleaned_county = raw_county.replace(" County", "").strip()
            try:
                area = float(row[area_idx].replace(",", "").strip())
                land_areas[cleaned_county] = area
            except ValueError:
                continue

    if census_key:
        print("CENSUS_API_KEY found. Fetching multi-year demographics from US Census API (2018-2023)...")
        inserted_count = 0
        for year in range(2018, 2024):
            print(f"  Fetching data for year {year}...")
            url = f"https://api.census.gov/data/{year}/acs/acs5?get=NAME,B01003_001E,B19013_001E&for=county:*&in=state:36&key={census_key}"
            census_req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                with urllib.request.urlopen(census_req) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
            except Exception as e:
                print(f"  Warning: Skipping year {year} due to Census API error: {e}", file=sys.stderr)
                continue

            census_header = data[0]
            name_col = census_header.index("NAME")
            pop_col = census_header.index("B01003_001E")
            inc_col = census_header.index("B19013_001E")

            for row in data[1:]:
                raw_county = row[name_col].split(",")[0].strip()
                cleaned_county = raw_county.replace(" County", "").strip()
                try:
                    pop = int(row[pop_col])
                except (ValueError, TypeError):
                    pop = None

                try:
                    val = float(row[inc_col])
                    income = val if val >= 0 else None
                except (ValueError, TypeError):
                    income = None

                area = land_areas.get(cleaned_county)

                con.execute("""
                    INSERT OR REPLACE INTO ny_county_demographics_dim 
                    (county, population, land_area, median_income, data_year)
                    VALUES (?, ?, ?, ?, ?);
                """, (cleaned_county, pop, area, income, year))
                inserted_count += 1
        print(f"Successfully inserted {inserted_count} rows from US Census API.")
    else:
        print("CENSUS_API_KEY NOT found. Sourcing demographics from CORGIS fallback for year 2020...")
        inserted_count = 0
        for row in corgis_rows:
            if row[state_idx].strip() == "NY":
                raw_county = row[county_idx].strip()
                cleaned_county = raw_county.replace(" County", "").strip()
                try:
                    pop = int(row[pop_idx].replace(",", "").strip())
                    area = float(row[area_idx].replace(",", "").strip())
                    income = float(row[income_idx].replace(",", "").strip())
                except ValueError as e:
                    print(f"Warning: Skipping county {raw_county} due to conversion error: {e}", file=sys.stderr)
                    continue

                con.execute("""
                    INSERT OR REPLACE INTO ny_county_demographics_dim 
                    (county, population, land_area, median_income, data_year)
                    VALUES (?, ?, ?, ?, 2020);
                """, (cleaned_county, pop, area, income))
                inserted_count += 1
        print(f"Successfully inserted {inserted_count} rows from CORGIS fallback.")

    print("Recreating database view v_ny_county_demographics_latest...")
    con.execute("""
        CREATE OR REPLACE VIEW v_ny_county_demographics_latest AS
        WITH ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY county ORDER BY data_year DESC) as rn
            FROM ny_county_demographics_dim
        )
        SELECT county, population, land_area, median_income, data_year
        FROM ranked
        WHERE rn = 1;
    """)

    # Query count of rows in the table
    count = con.execute("SELECT COUNT(*) FROM ny_county_demographics_dim").fetchone()[0]
    print(f"Total rows in ny_county_demographics_dim: {count}")
    
    # Show a few sample rows from latest view
    print("\nSample counties from v_ny_county_demographics_latest view:")
    samples = con.execute("SELECT * FROM v_ny_county_demographics_latest LIMIT 5").fetchall()
    for s in samples:
        print(f"  {s[0]} ({s[4]}): Pop={s[1]:,}, Area={s[2]:,.1f} sq mi, Income=${s[3]:,.2f}")
        
    con.close()
    print("Ingestion job complete.")

if __name__ == "__main__":
    main()

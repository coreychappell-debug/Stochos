#!/usr/bin/env python3
import urllib.request
import csv
import duckdb
import sys

db_path = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
csv_url = "https://corgis-edu.github.io/corgis/datasets/csv/county_demographics/county_demographics.csv"

def main():
    print(f"Connecting to DuckDB at {db_path}...")
    try:
        con = duckdb.connect(db_path)
    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        sys.exit(1)

    print("Creating table ny_county_demographics_dim if it does not exist...")
    con.execute("""
        CREATE TABLE IF NOT EXISTS ny_county_demographics_dim (
            county VARCHAR PRIMARY KEY,
            population INTEGER,
            land_area DOUBLE,
            median_income DOUBLE
        );
    """)

    print(f"Downloading Census demographics CSV from {csv_url}...")
    req = urllib.request.Request(csv_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            lines = [line.decode('utf-8') for line in response.read().splitlines()]
    except Exception as e:
        print(f"Error downloading CSV: {e}", file=sys.stderr)
        sys.exit(1)

    reader = csv.reader(lines)
    header = next(reader)

    # Find column indices
    county_idx = -1
    state_idx = -1
    income_idx = -1
    area_idx = -1
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

    if -1 in (county_idx, state_idx, income_idx, area_idx, pop_idx):
        print(f"Error: Could not find all required columns in CSV header. Index mapping: county={county_idx}, state={state_idx}, income={income_idx}, area={area_idx}, pop={pop_idx}", file=sys.stderr)
        sys.exit(1)

    print("Parsing rows and inserting into DuckDB...")
    inserted_count = 0
    for row in reader:
        if row[state_idx].strip() == "NY":
            raw_county = row[county_idx].strip()
            # Clean county name (e.g. "Albany County" -> "Albany")
            cleaned_county = raw_county.replace(" County", "").strip()
            
            try:
                pop = int(row[pop_idx].replace(",", "").strip())
                area = float(row[area_idx].replace(",", "").strip())
                income = float(row[income_idx].replace(",", "").strip())
            except ValueError as e:
                print(f"Warning: Skipping county {raw_county} due to conversion error: {e}", file=sys.stderr)
                continue
            
            con.execute("""
                INSERT OR REPLACE INTO ny_county_demographics_dim (county, population, land_area, median_income)
                VALUES (?, ?, ?, ?);
            """, (cleaned_county, pop, area, income))
            inserted_count += 1

    print(f"Successfully processed {inserted_count} counties.")
    
    # Query count of rows in the table
    count = con.execute("SELECT COUNT(*) FROM ny_county_demographics_dim").fetchone()[0]
    print(f"Total counties in table: {count}")
    
    # Show a few sample rows
    print("\nSample counties from DB:")
    samples = con.execute("SELECT * FROM ny_county_demographics_dim LIMIT 5").fetchall()
    for s in samples:
        print(f"  {s[0]}: Pop={s[1]:,}, Area={s[2]:,.1f} sq mi, Income=${s[3]:,.2f}")
        
    con.close()
    print("Ingestion job complete.")

if __name__ == "__main__":
    main()

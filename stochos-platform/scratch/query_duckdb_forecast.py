import duckdb
import json

DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

def main():
    con = duckdb.connect(DUCKDB_PATH, read_only=True)
    
    print("=== DUCKDB TABLES ===")
    tables = con.execute("SHOW TABLES").fetchall()
    print([t[0] for t in tables])
    
    print("\n=== mart_exec_forecast_monthly SCHEMA ===")
    schema_monthly = con.execute("DESCRIBE mart_exec_forecast_monthly").fetchall()
    for col in schema_monthly:
        print(f"  Column: {col[0]}, Type: {col[1]}")
        
    print("\n=== mart_exec_forecast_summary SCHEMA ===")
    schema_summary = con.execute("DESCRIBE mart_exec_forecast_summary").fetchall()
    for col in schema_summary:
        print(f"  Column: {col[0]}, Type: {col[1]}")
        
    print("\n=== SAMPLE DATA FROM mart_exec_forecast_monthly ===")
    sample_m = con.execute("SELECT * FROM mart_exec_forecast_monthly LIMIT 5").fetchall()
    for row in sample_m:
        print(row)
        
    print("\n=== UNIQUE METRICS IN FORECASTS ===")
    metrics = con.execute("SELECT DISTINCT metric_name FROM mart_exec_forecast_monthly").fetchall()
    print([m[0] for m in metrics])

    # Check if there are other columns, like product_group, game_family, or anything that lets us filter by game/price point!
    print("\n=== DO WE HAVE PRODUCT GROUP OR GAME IN FORECASTS? ===")
    cols = [c[0] for c in schema_monthly]
    if "product_group" in cols or "game_code" in cols or "product_id" in cols or "game_family" in cols or "category" in cols:
        print("Yes, we have columns:", [c for c in cols if c in ["product_group", "game_code", "product_id", "game_family", "category"]])
    else:
        print("No product columns in monthly forecast. Columns are:", cols)

    con.close()

if __name__ == "__main__":
    main()

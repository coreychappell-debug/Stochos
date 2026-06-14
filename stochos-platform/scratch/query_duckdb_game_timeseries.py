import duckdb

DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

def main():
    con = duckdb.connect(DUCKDB_PATH, read_only=True)
    
    print("=== mart_ny_game_timeseries SCHEMA ===")
    try:
        schema = con.execute("DESCRIBE mart_ny_game_timeseries").fetchall()
        for col in schema:
            print(f"  Column: {col[0]}, Type: {col[1]}")
        sample = con.execute("SELECT * FROM mart_ny_game_timeseries LIMIT 3").fetchall()
        print("  Sample row:", sample[0] if sample else "No data")
        
        # Unique game names
        games = con.execute("SELECT DISTINCT game_name FROM mart_ny_game_timeseries").fetchall()
        print(f"  Unique games ({len(games)}):", [g[0] for g in games[:10]])
    except Exception as e:
        print("  Error:", e)

    print("\n=== mart_exec_price_point_mix SCHEMA ===")
    try:
        schema = con.execute("DESCRIBE mart_exec_price_point_mix").fetchall()
        for col in schema:
            print(f"  Column: {col[0]}, Type: {col[1]}")
        sample = con.execute("SELECT * FROM mart_exec_price_point_mix LIMIT 3").fetchall()
        print("  Sample row:", sample[0] if sample else "No data")
        
        # Unique price points
        pps = con.execute("SELECT DISTINCT price_point FROM mart_exec_price_point_mix").fetchall()
        print("  Unique price points:", [p[0] for p in pps])
    except Exception as e:
        print("  Error:", e)
        
    con.close()

if __name__ == "__main__":
    main()

import duckdb

DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

def main():
    con = duckdb.connect(DUCKDB_PATH, read_only=True)
    
    cats = con.execute("SELECT DISTINCT category FROM mart_ny_game_timeseries").fetchall()
    print("Unique categories / games in timeseries:")
    for c in cats:
        print(f"  - {c[0]}")
        
    con.close()

if __name__ == "__main__":
    main()

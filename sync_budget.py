import psycopg2
import duckdb
import datetime
from datetime import timedelta

# DB Connections
PG_CONN_STR = "postgresql://stochos:stochos_dev_2026@localhost:5433/stochos_platform"
DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

def sync():
    # 1. Connect to PostgreSQL
    pg_conn = psycopg2.connect(PG_CONN_STR)
    pg_cur = pg_conn.cursor()
    
    # Fetch plans, scenarios, games
    pg_cur.execute("""
        SELECT 
            p.id AS plan_id,
            p.name AS plan_name,
            p.fiscal_year,
            p.sell_through_pct,
            s.id AS scenario_id,
            s.name AS scenario_name,
            g.game_number,
            g.name AS game_name,
            g.denomination,
            g.units,
            g.payout_percent,
            g.launch_date,
            g.close_date
        FROM instant_ticket_plans p
        JOIN instant_ticket_scenarios s ON s.plan_id = p.id
        JOIN instant_ticket_games g ON g.scenario_id = s.id
        WHERE p.status != 'archived'
    """)
    
    rows = pg_cur.fetchall()
    pg_conn.close()
    
    if not rows:
        print("No plans or games found to sync.")
        return
        
    print(f"Fetched {len(rows)} game rows from PostgreSQL.")
    
    # 2. Process games into detailed list and daily series
    detailed_data = []
    daily_data = []
    
    for r in rows:
        (plan_id, plan_name, fiscal_year, sell_through_pct, 
         scenario_id, scenario_name, game_number, game_name, 
         denomination, units, payout_percent, launch_date, close_date) = r
         
        # Convert Decimals to float
        sell_through_pct = float(sell_through_pct)
        payout_percent = float(payout_percent)
        units = int(units)
        denomination = int(denomination)
        
        # Calculate total planned revenue and payout
        total_planned_revenue = units * denomination * (sell_through_pct / 100.0)
        total_planned_payout = total_planned_revenue * (payout_percent / 100.0)
        
        detailed_data.append((
            plan_id, plan_name, int(fiscal_year), scenario_id, scenario_name,
            game_number, game_name, denomination, units, payout_percent, sell_through_pct,
            launch_date, close_date, total_planned_revenue, total_planned_payout
        ))
        
        # Calculate start and end dates for daily distribution
        # Start date: launch_date, or start of fiscal year if null
        start_date = launch_date
        if start_date is None:
            start_date = datetime.date(fiscal_year - 1, 4, 1)
            
        # End date: close_date, or start_date + 179 days, but capped at end of fiscal year
        end_of_fy = datetime.date(fiscal_year, 3, 31)
        if close_date is not None:
            end_date = close_date
        else:
            end_date = min(start_date + timedelta(days=179), end_of_fy)
            
        # Ensure end_date >= start_date
        if end_date < start_date:
            end_date = start_date
            
        num_days = (end_date - start_date).days + 1
        daily_revenue = total_planned_revenue / num_days
        daily_payout = total_planned_payout / num_days
        
        curr_date = start_date
        while curr_date <= end_date:
            daily_data.append((
                curr_date, plan_id, plan_name, scenario_id, scenario_name,
                game_number, game_name, denomination, daily_revenue, daily_payout
            ))
            curr_date += timedelta(days=1)
            
    # 3. Connect to DuckDB and write tables
    duck_conn = duckdb.connect(DUCKDB_PATH)
    
    # Recreate detailed table
    duck_conn.execute("DROP TABLE IF EXISTS instant_ticket_plan_budget_raw")
    duck_conn.execute("""
        CREATE TABLE instant_ticket_plan_budget_raw (
            plan_id VARCHAR,
            plan_name VARCHAR,
            fiscal_year INTEGER,
            scenario_id VARCHAR,
            scenario_name VARCHAR,
            game_number VARCHAR,
            game_name VARCHAR,
            denomination INTEGER,
            units BIGINT,
            payout_percent DOUBLE,
            sell_through_pct DOUBLE,
            launch_date DATE,
            close_date DATE,
            total_planned_revenue DOUBLE,
            total_planned_payout DOUBLE
        )
    """)
    
    if detailed_data:
        duck_conn.executemany("INSERT INTO instant_ticket_plan_budget_raw VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", detailed_data)
    
    # Recreate daily table
    duck_conn.execute("DROP TABLE IF EXISTS instant_ticket_plan_budget_daily")
    duck_conn.execute("""
        CREATE TABLE instant_ticket_plan_budget_daily (
            date DATE,
            plan_id VARCHAR,
            plan_name VARCHAR,
            scenario_id VARCHAR,
            scenario_name VARCHAR,
            game_number VARCHAR,
            game_name VARCHAR,
            denomination INTEGER,
            planned_revenue DOUBLE,
            planned_payout DOUBLE
        )
    """)
    
    if daily_data:
        duck_conn.executemany("INSERT INTO instant_ticket_plan_budget_daily VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", daily_data)
        
    # Build aggregate mart table for faster dashboard queries
    duck_conn.execute("DROP TABLE IF EXISTS instant_ticket_plan_budget")
    duck_conn.execute("""
        CREATE TABLE instant_ticket_plan_budget AS
        SELECT 
            plan_id, plan_name, fiscal_year, scenario_id, scenario_name,
            SUM(total_planned_revenue) AS total_planned_revenue,
            SUM(total_planned_payout) AS total_planned_payout,
            COUNT(DISTINCT game_number) AS total_planned_games
        FROM instant_ticket_plan_budget_raw
        GROUP BY plan_id, plan_name, fiscal_year, scenario_id, scenario_name
    """)
    
    print(f"Successfully synced detailed budget rows: {len(detailed_data)}")
    print(f"Successfully synced daily budget rows: {len(daily_data)}")
    
    duck_conn.close()

if __name__ == "__main__":
    sync()

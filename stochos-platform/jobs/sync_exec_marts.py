import psycopg2
import duckdb
import uuid

DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
PG_CONN_STR = "postgresql://stochos:stochos_dev_2026@localhost:5433/stochos_platform"

def sync_marts():
    print("Connecting to databases...")
    duck_con = duckdb.connect(DUCKDB_PATH, read_only=True)
    pg_con = psycopg2.connect(PG_CONN_STR)
    pg_cur = pg_con.cursor()

    try:
        # 1. Sync mart_exec_overview_daily
        print("Syncing mart_exec_overview_daily...")
        duck_cur = duck_con.cursor()
        duck_cur.execute("""
            SELECT 
                date, gross_revenue, estimated_payout, retailer_commission, 
                net_contribution, active_retailers, active_games, 
                avg_sales_per_retailer, draw_revenue, scratch_revenue 
            FROM mart_exec_overview_daily
        """)
        rows = duck_cur.fetchall()
        print(f"  Found {len(rows)} daily overview rows in DuckDB.")

        # Clear existing
        pg_cur.execute("TRUNCATE TABLE mart_exec_overview_daily")

        # Insert new
        insert_query = """
            INSERT INTO mart_exec_overview_daily (
                id, date, gross_revenue, estimated_payout, retailer_commission, 
                net_contribution, active_retailers, active_games, 
                avg_sales_per_retailer, draw_revenue, scratch_revenue
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_query, (uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]))
        print("  mart_exec_overview_daily synchronized.")

        # 2. Sync mart_exec_mix_summary
        print("Syncing mart_exec_mix_summary...")
        duck_cur.execute("""
            SELECT 
                product_group, gross_revenue, net_contribution, 
                pct_sales, pct_contribution, contribution_rate 
            FROM mart_exec_mix_summary
        """)
        rows_mix = duck_cur.fetchall()
        print(f"  Found {len(rows_mix)} product mix rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_mix_summary")
        insert_mix = """
            INSERT INTO mart_exec_mix_summary (
                id, product_group, gross_revenue, net_contribution, 
                pct_sales, pct_contribution, contribution_rate
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_mix:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_mix, (uid, r[0], r[1], r[2], r[3], r[4], r[5]))
        print("  mart_exec_mix_summary synchronized.")

        # 3. Sync mart_exec_alerts
        print("Syncing mart_exec_alerts...")
        duck_cur.execute("""
            SELECT 
                alert_type, alert_label, alert_value, comparison_value, 
                variance_abs, variance_pct, severity, alert_date 
            FROM mart_exec_alerts
        """)
        rows_alerts = duck_cur.fetchall()
        print(f"  Found {len(rows_alerts)} alert rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_alerts")
        insert_alerts = """
            INSERT INTO mart_exec_alerts (
                id, alert_type, alert_label, alert_value, comparison_value, 
                variance_abs, variance_pct, severity, alert_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_alerts:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_alerts, (uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]))
        print("  mart_exec_alerts synchronized.")

        # 4. Sync mart_exec_retailer_mix
        print("Syncing mart_exec_retailer_mix...")
        duck_cur.execute("""
            SELECT 
                retailer_id, retailer_name, city, county, business_type, quick_draw_flag,
                latitude, longitude, gross_revenue, net_contribution, estimated_payout,
                retailer_commission, draw_revenue, scratch_revenue, draw_share, scratch_share,
                contribution_rate, active_days, avg_daily_sales, distinct_products
            FROM mart_exec_retailer_mix
        """)
        rows_ret_mix = duck_cur.fetchall()
        print(f"  Found {len(rows_ret_mix)} retailer mix rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_retailer_mix")
        insert_ret_mix = """
            INSERT INTO mart_exec_retailer_mix (
                id, retailer_id, retailer_name, city, county, business_type, quick_draw_flag,
                latitude, longitude, gross_revenue, net_contribution, estimated_payout,
                retailer_commission, draw_revenue, scratch_revenue, draw_share, scratch_share,
                contribution_rate, active_days, avg_daily_sales, distinct_products
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_ret_mix:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_ret_mix, (
                uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9],
                r[10], r[11], r[12], r[13], r[14], r[15], r[16], r[17], r[18], r[19]
            ))
        print("  mart_exec_retailer_mix synchronized.")

        # 5. Sync mart_exec_retailer_quadrants
        print("Syncing mart_exec_retailer_quadrants...")
        duck_cur.execute("""
            SELECT 
                retailer_id, retailer_name, city, county, business_type, draw_share,
                scratch_share, contribution_rate, gross_revenue, net_contribution,
                avg_daily_sales, sales_band, quadrant_label, median_draw_share, median_contribution_rate
            FROM mart_exec_retailer_quadrants
        """)
        rows_quad = duck_cur.fetchall()
        print(f"  Found {len(rows_quad)} retailer quadrant rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_retailer_quadrants")
        insert_quad = """
            INSERT INTO mart_exec_retailer_quadrants (
                id, retailer_id, retailer_name, city, county, business_type, draw_share,
                scratch_share, contribution_rate, gross_revenue, net_contribution,
                avg_daily_sales, sales_band, quadrant_label, median_draw_share, median_contribution_rate
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_quad:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_quad, (
                uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9],
                r[10], r[11], r[12], r[13], r[14]
            ))
        print("  mart_exec_retailer_quadrants synchronized.")

        # 6. Sync mart_exec_channel_mix
        print("Syncing mart_exec_channel_mix...")
        duck_cur.execute("""
            SELECT 
                business_type, retailer_count, gross_revenue, net_contribution,
                draw_revenue, scratch_revenue, draw_share, scratch_share,
                avg_sales_per_retailer, contribution_rate
            FROM mart_exec_channel_mix
        """)
        rows_chan = duck_cur.fetchall()
        print(f"  Found {len(rows_chan)} channel mix rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_channel_mix")
        insert_chan = """
            INSERT INTO mart_exec_channel_mix (
                id, business_type, retailer_count, gross_revenue, net_contribution,
                draw_revenue, scratch_revenue, draw_share, scratch_share,
                avg_sales_per_retailer, contribution_rate
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_chan:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_chan, (
                uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]
            ))
        print("  mart_exec_channel_mix synchronized.")

        # 7. Sync mart_exec_product_mix
        print("Syncing mart_exec_product_mix...")
        duck_cur.execute("""
            SELECT 
                product_group, game_family, gross_revenue, net_contribution, 
                retailer_count, pct_sales, pct_contribution, contribution_rate
            FROM mart_exec_product_mix
        """)
        rows_prod_mix = duck_cur.fetchall()
        print(f"  Found {len(rows_prod_mix)} product mix rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_product_mix")
        insert_prod_mix = """
            INSERT INTO mart_exec_product_mix (
                id, product_group, game_family, gross_revenue, net_contribution, 
                retailer_count, pct_sales, pct_contribution, contribution_rate
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_prod_mix:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_prod_mix, (uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]))
        print("  mart_exec_product_mix synchronized.")

        # 8. Sync mart_exec_product_lifecycle
        print("Syncing mart_exec_product_lifecycle...")
        duck_cur.execute("""
            SELECT 
                game_code, game_name, game_family, product_group, first_observed, 
                last_observed, lifecycle_status, gross_revenue, net_contribution, 
                active_days, contribution_rate, trend_direction
            FROM mart_exec_product_lifecycle
        """)
        rows_lifecycle = duck_cur.fetchall()
        print(f"  Found {len(rows_lifecycle)} product lifecycle rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_product_lifecycle")
        insert_lifecycle = """
            INSERT INTO mart_exec_product_lifecycle (
                id, game_code, game_name, game_family, product_group, first_observed, 
                last_observed, lifecycle_status, gross_revenue, net_contribution, 
                active_days, contribution_rate, trend_direction
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_lifecycle:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_lifecycle, (
                uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]
            ))
        print("  mart_exec_product_lifecycle synchronized.")

        # 9. Sync mart_exec_product_timeseries
        print("Syncing mart_exec_product_timeseries...")
        duck_cur.execute("""
            SELECT 
                month, product_group, gross_revenue, net_contribution, contribution_rate
            FROM mart_exec_product_timeseries
        """)
        rows_prod_ts = duck_cur.fetchall()
        print(f"  Found {len(rows_prod_ts)} product timeseries rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_product_timeseries")
        insert_prod_ts = """
            INSERT INTO mart_exec_product_timeseries (
                id, month, product_group, gross_revenue, net_contribution, contribution_rate
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """
        for r in rows_prod_ts:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_prod_ts, (uid, r[0], r[1], r[2], r[3], r[4]))
        print("  mart_exec_product_timeseries synchronized.")

        # 10. Sync mart_exec_geo_contribution (with Demographics)
        print("Syncing mart_exec_geo_contribution...")
        duck_cur.execute("""
            SELECT 
                g.geo_level, g.county, g.city, g.gross_revenue, g.net_contribution, 
                g.retailer_count, g.avg_sales_per_retailer, g.contribution_rate, 
                g.draw_share, g.scratch_share,
                c.population, c.land_area, c.median_income, c.dma, c.service_center,
                c.sales_per_capita, c.net_contribution_per_capita, 
                c.retailers_per_sq_mile, c.residents_per_retailer
            FROM mart_exec_geo_contribution g
            LEFT JOIN mart_ny_county_summary c ON g.geo_level = 'county' AND g.county = c.county
        """)
        rows_geo = duck_cur.fetchall()
        print(f"  Found {len(rows_geo)} geographic contribution rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_geo_contribution")
        insert_geo = """
            INSERT INTO mart_exec_geo_contribution (
                id, geo_level, county, city, gross_revenue, net_contribution, 
                retailer_count, avg_sales_per_retailer, contribution_rate, 
                draw_share, scratch_share, population, land_area, median_income, 
                dma, service_center, sales_per_capita, net_contribution_per_capita, 
                retailers_per_sq_mile, residents_per_retailer
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_geo:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_geo, (
                uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9],
                r[10], r[11], r[12], r[13], r[14], r[15], r[16], r[17], r[18]
            ))
        print("  mart_exec_geo_contribution synchronized.")

        # 11. Sync mart_exec_geo_channel_mix
        print("Syncing mart_exec_geo_channel_mix...")
        duck_cur.execute("""
            SELECT 
                county, business_type, retailer_count, gross_revenue, 
                net_contribution, draw_share, scratch_share
            FROM mart_exec_geo_channel_mix
        """)
        rows_geo_chan = duck_cur.fetchall()
        print(f"  Found {len(rows_geo_chan)} geo channel mix rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_exec_geo_channel_mix")
        insert_geo_chan = """
            INSERT INTO mart_exec_geo_channel_mix (
                id, county, business_type, retailer_count, gross_revenue, 
                net_contribution, draw_share, scratch_share
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        for r in rows_geo_chan:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_geo_chan, (uid, r[0], r[1], r[2], r[3], r[4], r[5], r[6]))
        print("  mart_exec_geo_channel_mix synchronized.")

        # 12. Sync mart_ny_game_timeseries
        print("Syncing mart_ny_game_timeseries...")
        duck_cur.execute("""
            SELECT 
                date, category, gross_revenue, net_contribution, active_retailers
            FROM mart_ny_game_timeseries
        """)
        rows_game_ts = duck_cur.fetchall()
        print(f"  Found {len(rows_game_ts)} game timeseries rows in DuckDB.")

        pg_cur.execute("TRUNCATE TABLE mart_ny_game_timeseries")
        insert_game_ts = """
            INSERT INTO mart_ny_game_timeseries (
                id, date, category, gross_revenue, net_contribution, active_retailers
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """
        for r in rows_game_ts:
            uid = str(uuid.uuid4())
            pg_cur.execute(insert_game_ts, (uid, r[0], r[1], r[2], r[3], r[4]))
        print("  mart_ny_game_timeseries synchronized.")

        # Commit transaction
        pg_con.commit()
        print("Sync completed successfully.")

    except Exception as e:
        pg_con.rollback()
        print("Error during sync:", e)
        raise e
    finally:
        pg_con.close()
        duck_con.close()

if __name__ == "__main__":
    sync_marts()

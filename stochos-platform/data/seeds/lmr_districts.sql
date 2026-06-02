-- =============================================================================
-- Seed NY Sales Regions and LMR Districts Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS ny_county_regions_dim (
    county VARCHAR PRIMARY KEY,
    region VARCHAR NOT NULL,
    lmr_district VARCHAR NOT NULL,
    rep_count INTEGER NOT NULL
);

-- NYC Region (5 counties, 20 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Bronx', 'NYC', 'NYC-Bronx', 4);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Kings', 'NYC', 'NYC-Brooklyn', 6);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('New York', 'NYC', 'NYC-Manhattan', 5);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Queens', 'NYC', 'NYC-Queens', 4);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Richmond', 'NYC', 'NYC-StatenIsland', 1);

-- Suburban Region (7 counties, 15 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Nassau', 'Suburban', 'SUB-Nassau', 4);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Suffolk', 'Suburban', 'SUB-Suffolk', 4);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Westchester', 'Suburban', 'SUB-Westchester', 3);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Rockland', 'Suburban', 'SUB-Rockland', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Orange', 'Suburban', 'SUB-Orange', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Putnam', 'Suburban', 'SUB-Putnam', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Dutchess', 'Suburban', 'SUB-Dutchess', 1);

-- Central Region (13 counties, 8 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Onondaga', 'Central', 'CEN-Onondaga', 2);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Oneida', 'Central', 'CEN-Utica', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Herkimer', 'Central', 'CEN-Utica', 0); -- Shared rep under Utica
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Jefferson', 'Central', 'CEN-NorthCountry', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Lewis', 'Central', 'CEN-NorthCountry', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('St. Lawrence', 'Central', 'CEN-NorthCountry', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Broome', 'Central', 'CEN-SouthernTier', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Cortland', 'Central', 'CEN-SouthernTier', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Chenango', 'Central', 'CEN-SouthernTier', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Tompkins', 'Central', 'CEN-FingerLakes', 2); -- 2 reps for academic/tech centers
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Cayuga', 'Central', 'CEN-FingerLakes', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Madison', 'Central', 'CEN-FingerLakes', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Oswego', 'Central', 'CEN-Oswego', 1);

-- Western Region (17 counties, 12 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Erie', 'Western', 'WES-Erie', 4);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Monroe', 'Western', 'WES-Monroe', 3);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Niagara', 'Western', 'WES-Niagara', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Chautauqua', 'Western', 'WES-SouthernTier', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Cattaraugus', 'Western', 'WES-SouthernTier', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Allegany', 'Western', 'WES-SouthernTier', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Wayne', 'Western', 'WES-EastFingerLakes', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Ontario', 'Western', 'WES-EastFingerLakes', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Seneca', 'Western', 'WES-EastFingerLakes', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Yates', 'Western', 'WES-EastFingerLakes', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Genesee', 'Western', 'WES-GeneseeValley', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Orleans', 'Western', 'WES-GeneseeValley', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Wyoming', 'Western', 'WES-GeneseeValley', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Livingston', 'Western', 'WES-GeneseeValley', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Chemung', 'Western', 'WES-ChemungSteuben', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Steuben', 'Western', 'WES-ChemungSteuben', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Schuyler', 'Western', 'WES-ChemungSteuben', 0); -- Shared

-- Upstate Eastern Region (20 counties, 10 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Albany', 'Upstate Eastern', 'EAS-CapitalDistrict', 2);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Rensselaer', 'Upstate Eastern', 'EAS-CapitalDistrict', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Schenectady', 'Upstate Eastern', 'EAS-CapitalDistrict', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Saratoga', 'Upstate Eastern', 'EAS-SaratogaGlensFalls', 2);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Warren', 'Upstate Eastern', 'EAS-SaratogaGlensFalls', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Washington', 'Upstate Eastern', 'EAS-SaratogaGlensFalls', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Clinton', 'Upstate Eastern', 'EAS-Adirondacks', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Essex', 'Upstate Eastern', 'EAS-Adirondacks', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Franklin', 'Upstate Eastern', 'EAS-Adirondacks', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Fulton', 'Upstate Eastern', 'EAS-MohawkValley', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Montgomery', 'Upstate Eastern', 'EAS-MohawkValley', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Schoharie', 'Upstate Eastern', 'EAS-MohawkValley', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Otsego', 'Upstate Eastern', 'EAS-SusquehannaCatskills', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Delaware', 'Upstate Eastern', 'EAS-SusquehannaCatskills', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Sullivan', 'Upstate Eastern', 'EAS-SusquehannaCatskills', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Ulster', 'Upstate Eastern', 'EAS-MidHudson', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Greene', 'Upstate Eastern', 'EAS-MidHudson', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Columbia', 'Upstate Eastern', 'EAS-MidHudson', 0); -- Shared
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Tioga', 'Upstate Eastern', 'EAS-Tioga', 1);
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count) VALUES ('Hamilton', 'Upstate Eastern', 'EAS-Adirondacks', 0); -- Shared rep under Adirondacks


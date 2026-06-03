-- =============================================================================
-- Seed NY Sales Regions and LMR Districts Table
-- =============================================================================

DROP TABLE IF EXISTS ny_county_regions_dim;

CREATE TABLE ny_county_regions_dim (
    county VARCHAR PRIMARY KEY,
    region VARCHAR NOT NULL,
    lmr_district VARCHAR NOT NULL,
    rep_count INTEGER NOT NULL,
    dma VARCHAR NOT NULL,
    service_center VARCHAR NOT NULL
);

-- NYC Region (5 counties, 20 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Bronx', 'NYC', 'NYC-Bronx', 4, 'New York City DMA', 'Manhattan (NYC)');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Kings', 'NYC', 'NYC-Brooklyn', 6, 'New York City DMA', 'Manhattan (NYC)');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('New York', 'NYC', 'NYC-Manhattan', 5, 'New York City DMA', 'Manhattan (NYC)');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Queens', 'NYC', 'NYC-Queens', 4, 'New York City DMA', 'Manhattan (NYC)');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Richmond', 'NYC', 'NYC-StatenIsland', 1, 'New York City DMA', 'Manhattan (NYC)');

-- Suburban Region (7 counties, 15 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Nassau', 'Suburban', 'SUB-Nassau', 4, 'New York City DMA', 'Long Island (Garden City)');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Suffolk', 'Suburban', 'SUB-Suffolk', 4, 'New York City DMA', 'Long Island (Garden City)');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Westchester', 'Suburban', 'SUB-Westchester', 3, 'New York City DMA', 'Fishkill');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Rockland', 'Suburban', 'SUB-Rockland', 1, 'New York City DMA', 'Fishkill');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Orange', 'Suburban', 'SUB-Orange', 1, 'New York City DMA', 'Fishkill');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Putnam', 'Suburban', 'SUB-Putnam', 1, 'New York City DMA', 'Fishkill');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Dutchess', 'Suburban', 'SUB-Dutchess', 1, 'New York City DMA', 'Fishkill');

-- Central Region (13 counties, 8 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Onondaga', 'Central', 'CEN-Onondaga', 2, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Oneida', 'Central', 'CEN-Utica', 1, 'Utica DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Herkimer', 'Central', 'CEN-Utica', 0, 'Utica DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Jefferson', 'Central', 'CEN-NorthCountry', 1, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Lewis', 'Central', 'CEN-NorthCountry', 0, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('St. Lawrence', 'Central', 'CEN-NorthCountry', 0, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Broome', 'Central', 'CEN-SouthernTier', 1, 'Binghamton DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Cortland', 'Central', 'CEN-SouthernTier', 0, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Chenango', 'Central', 'CEN-SouthernTier', 0, 'Binghamton DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Tompkins', 'Central', 'CEN-FingerLakes', 2, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Cayuga', 'Central', 'CEN-FingerLakes', 0, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Madison', 'Central', 'CEN-FingerLakes', 0, 'Syracuse DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Oswego', 'Central', 'CEN-Oswego', 1, 'Syracuse DMA', 'Syracuse');

-- Western Region (17 counties, 12 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Erie', 'Western', 'WES-Erie', 4, 'Buffalo DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Monroe', 'Western', 'WES-Monroe', 3, 'Rochester DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Niagara', 'Western', 'WES-Niagara', 1, 'Buffalo DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Chautauqua', 'Western', 'WES-SouthernTier', 1, 'Buffalo DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Cattaraugus', 'Western', 'WES-SouthernTier', 0, 'Buffalo DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Allegany', 'Western', 'WES-SouthernTier', 0, 'Buffalo DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Wayne', 'Western', 'WES-EastFingerLakes', 1, 'Rochester DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Ontario', 'Western', 'WES-EastFingerLakes', 0, 'Rochester DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Seneca', 'Western', 'WES-EastFingerLakes', 0, 'Rochester DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Yates', 'Western', 'WES-EastFingerLakes', 0, 'Rochester DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Genesee', 'Western', 'WES-GeneseeValley', 1, 'Rochester DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Orleans', 'Western', 'WES-GeneseeValley', 0, 'Rochester DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Wyoming', 'Western', 'WES-GeneseeValley', 0, 'Buffalo DMA', 'Buffalo');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Livingston', 'Western', 'WES-GeneseeValley', 0, 'Rochester DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Chemung', 'Western', 'WES-ChemungSteuben', 1, 'Binghamton DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Steuben', 'Western', 'WES-ChemungSteuben', 0, 'Binghamton DMA', 'Rochester');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Schuyler', 'Western', 'WES-ChemungSteuben', 0, 'Binghamton DMA', 'Rochester');

-- Upstate Eastern Region (20 counties, 10 reps)
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Albany', 'Upstate Eastern', 'EAS-CapitalDistrict', 2, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Rensselaer', 'Upstate Eastern', 'EAS-CapitalDistrict', 1, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Schenectady', 'Upstate Eastern', 'EAS-CapitalDistrict', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Saratoga', 'Upstate Eastern', 'EAS-SaratogaGlensFalls', 2, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Warren', 'Upstate Eastern', 'EAS-SaratogaGlensFalls', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Washington', 'Upstate Eastern', 'EAS-SaratogaGlensFalls', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Clinton', 'Upstate Eastern', 'EAS-Adirondacks', 1, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Essex', 'Upstate Eastern', 'EAS-Adirondacks', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Franklin', 'Upstate Eastern', 'EAS-Adirondacks', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Fulton', 'Upstate Eastern', 'EAS-MohawkValley', 1, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Montgomery', 'Upstate Eastern', 'EAS-MohawkValley', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Schoharie', 'Upstate Eastern', 'EAS-MohawkValley', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Otsego', 'Upstate Eastern', 'EAS-SusquehannaCatskills', 1, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Delaware', 'Upstate Eastern', 'EAS-SusquehannaCatskills', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Sullivan', 'Upstate Eastern', 'EAS-SusquehannaCatskills', 0, 'New York City DMA', 'Fishkill');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Ulster', 'Upstate Eastern', 'EAS-MidHudson', 1, 'New York City DMA', 'Fishkill');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Greene', 'Upstate Eastern', 'EAS-MidHudson', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Columbia', 'Upstate Eastern', 'EAS-MidHudson', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Tioga', 'Upstate Eastern', 'EAS-Tioga', 1, 'Binghamton DMA', 'Syracuse');
INSERT OR REPLACE INTO ny_county_regions_dim (county, region, lmr_district, rep_count, dma, service_center) VALUES ('Hamilton', 'Upstate Eastern', 'EAS-Adirondacks', 0, 'Albany-Schenectady-Troy DMA', 'Schenectady');

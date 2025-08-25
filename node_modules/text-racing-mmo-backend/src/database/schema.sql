-- Text Racing MMO Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_races INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    league_points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Cars table
CREATE TABLE IF NOT EXISTS cars (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    specifications JSONB NOT NULL,
    licensing_info JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tracks table (for future expansion)
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    length_meters INTEGER NOT NULL,
    characteristics JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Races table
CREATE TABLE IF NOT EXISTS races (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES tracks(id),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    total_laps INTEGER NOT NULL DEFAULT 10,
    race_data JSONB,
    results JSONB,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Race participants table
CREATE TABLE IF NOT EXISTS race_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),
    car_id VARCHAR(100) NOT NULL REFERENCES cars(id),
    final_position INTEGER,
    final_time INTEGER, -- in milliseconds
    race_events JSONB,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(race_id, player_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_league_points ON players(league_points DESC);
CREATE INDEX IF NOT EXISTS idx_cars_manufacturer ON cars(manufacturer);
CREATE INDEX IF NOT EXISTS idx_cars_active ON cars(is_active);
CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
CREATE INDEX IF NOT EXISTS idx_races_start_time ON races(start_time);
CREATE INDEX IF NOT EXISTS idx_race_participants_race_id ON race_participants(race_id);
CREATE INDEX IF NOT EXISTS idx_race_participants_player_id ON race_participants(player_id);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cars_updated_at ON cars;
CREATE TRIGGER update_cars_updated_at BEFORE UPDATE ON cars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_races_updated_at ON races;
CREATE TRIGGER update_races_updated_at BEFORE UPDATE ON races
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
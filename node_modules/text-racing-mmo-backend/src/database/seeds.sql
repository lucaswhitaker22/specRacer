-- Seed data for Text Racing MMO

-- Insert default track
INSERT INTO tracks (id, name, length_meters, characteristics) VALUES 
(
  uuid_generate_v4(),
  'Silverstone Circuit',
  5891,
  '{
    "surface": "asphalt",
    "elevation_change": 15,
    "corners": 18,
    "difficulty": "medium",
    "weather_effects": true,
    "pit_lane_length": 350
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert licensed car models with authentic specifications
INSERT INTO cars (id, name, manufacturer, year, specifications, licensing_info, is_active) VALUES 
(
  'honda-civic-type-r-2023',
  'Civic Type R',
  'Honda',
  2023,
  '{
    "horsepower": 315,
    "weight": 1429,
    "dragCoefficient": 0.37,
    "frontalArea": 2.3,
    "drivetrain": "FWD",
    "tireGrip": 1.1,
    "gearRatios": [3.267, 2.130, 1.517, 1.147, 0.921, 0.738],
    "aeroDownforce": 85,
    "fuelEconomy": 8.7,
    "zeroToSixty": 5.4,
    "topSpeed": 272
  }'::jsonb,
  '{
    "source": "Honda Motor Co., Ltd.",
    "validUntil": "2025-12-31",
    "restrictions": ["Non-commercial use only", "Accurate specification representation required"]
  }'::jsonb,
  true
),
(
  'porsche-911-gt3-2022',
  '911 GT3',
  'Porsche',
  2022,
  '{
    "horsepower": 502,
    "weight": 1418,
    "dragCoefficient": 0.315,
    "frontalArea": 2.1,
    "drivetrain": "RWD",
    "tireGrip": 1.3,
    "gearRatios": [3.909, 2.316, 1.542, 1.179, 0.967, 0.784, 0.634],
    "aeroDownforce": 150,
    "fuelEconomy": 12.4,
    "zeroToSixty": 3.4,
    "topSpeed": 318
  }'::jsonb,
  '{
    "source": "Dr. Ing. h.c. F. Porsche AG",
    "validUntil": "2025-12-31",
    "restrictions": ["Educational and gaming use permitted", "Trademark acknowledgment required"]
  }'::jsonb,
  true
),
(
  'subaru-wrx-sti-2021',
  'WRX STI',
  'Subaru',
  2021,
  '{
    "horsepower": 310,
    "weight": 1568,
    "dragCoefficient": 0.35,
    "frontalArea": 2.4,
    "drivetrain": "AWD",
    "tireGrip": 1.15,
    "gearRatios": [3.636, 2.235, 1.521, 1.137, 0.971, 0.756],
    "aeroDownforce": 45,
    "fuelEconomy": 10.7,
    "zeroToSixty": 5.1,
    "topSpeed": 255
  }'::jsonb,
  '{
    "source": "Subaru Corporation",
    "validUntil": "2025-12-31",
    "restrictions": ["Gaming and simulation use approved", "Performance data based on manufacturer specifications"]
  }'::jsonb,
  true
) ON CONFLICT DO NOTHING;
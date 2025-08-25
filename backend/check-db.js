const { getDatabaseConnection } = require('./dist/backend/src/database/connection');

async function checkDatabase() {
  try {
    const db = getDatabaseConnection();
    
    console.log('Checking tracks...');
    const tracks = await db.query('SELECT id, name FROM tracks');
    console.log('Tracks:', tracks.rows);
    
    console.log('\nChecking cars...');
    const cars = await db.query('SELECT id, name FROM cars');
    console.log('Cars:', cars.rows);
    
    console.log('\nChecking races...');
    const races = await db.query('SELECT id, track_id, status FROM races');
    console.log('Races:', races.rows);
    
  } catch (error) {
    console.error('Database check failed:', error);
  } finally {
    process.exit(0);
  }
}

checkDatabase();
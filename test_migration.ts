import { migrateLocalToObjectStorage, getMigrationStatus } from './server/mediaService';

async function runMigration() {
  console.log('Starting migration test...');
  
  // Get status before
  const statusBefore = await getMigrationStatus();
  console.log('Before migration:', statusBefore);
  
  // Run migration batch of 10 images
  const result = await migrateLocalToObjectStorage(10);
  console.log('Migration result:', result);
  
  // Get status after
  const statusAfter = await getMigrationStatus();
  console.log('After migration:', statusAfter);
  
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

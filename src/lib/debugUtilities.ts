/**
 * Debug utilities for development only
 * These functions help manage IndexedDB during testing
 */

import Dexie from 'dexie';
import { hashPin } from './auth';

/**
 * Delete all PIN-scoped databases except for a specific PIN
 * Use this to clean up test databases in development
 * 
 * @param keepPin - The PIN to keep (e.g., "0720")
 * @example
 * // Run in browser console:
 * // import { deleteAllDatabasesExcept } from '@/lib/debugUtilities'
 * // deleteAllDatabasesExcept('0720')
 */
export async function deleteAllDatabasesExcept(keepPin: string): Promise<void> {
  try {
    console.log(`🧹 Starting cleanup: keeping PIN ${keepPin}, deleting all others...`);
    
    // Hash the kept PIN to get its database name prefix
    const keptPinHash = await hashPin(keepPin);
    const keptPrefix = keptPinHash.substring(0, 12);
    const keptDbName = `cc_review_db_${keptPrefix}`;
    
    console.log(`✓ Will keep database: ${keptDbName}`);
    
    // List of known databases to try deleting
    const dbNames = [
      'cc_review_db',
      'cc_review_db_0ffe1abd1a08',
      'cc_review_db_2926a2731f4b',
      'cc_review_db_9af15b336e6a',
      'cc_review_db_e8ec35e92762',
      'cc_review_db_a1b2c3d4e5f6',
      'cc_review_db_f6e5d4c3b2a1',
      'cc_review_db_3d4e5f6a1b2c',
    ];
    
    let deletedCount = 0;
    
    for (const dbName of dbNames) {
      // Skip the database we want to keep
      if (dbName === keptDbName) {
        console.log(`⏭️  Skipping (kept): ${dbName}`);
        continue;
      }
      
      try {
        await Dexie.delete(dbName);
        console.log(`✓ Deleted: ${dbName}`);
        deletedCount++;
      } catch (error) {
        // Database might not exist, which is fine
        console.log(`⏭️  Not found or already deleted: ${dbName}`);
      }
    }
    
    console.log(`✅ Cleanup complete! Deleted ${deletedCount} databases. Kept: ${keptDbName}`);
    console.log('💡 Tip: Refresh the page to see changes in DevTools.');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

/**
 * List all IndexedDB databases
 * @example
 * // Run in browser console:
 * // import { listAllDatabases } from '@/lib/debugUtilities'
 * // listAllDatabases()
 */
export async function listAllDatabases(): Promise<void> {
  try {
    // Note: There's no standard API to list all databases,
    // but we can check the DevTools or use the known list
    console.log('📊 Known databases:');
    const dbNames = [
      'cc_review_db',
      'cc_review_db_0ffe1abd1a08',
      'cc_review_db_2926a2731f4b',
      'cc_review_db_9af15b336e6a',
      'cc_review_db_e8ec35e92762',
    ];
    
    for (const dbName of dbNames) {
      try {
        // Try to open and check if it exists
        const db = new Dexie(dbName);
        await db.open();
        console.log(`✓ ${dbName} (exists)`);
        await db.close();
      } catch {
        console.log(`○ ${dbName} (not found)`);
      }
    }
    
    console.log('\n💡 To delete databases, use: deleteAllDatabasesExcept("0720")');
  } catch (error) {
    console.error('Error listing databases:', error);
  }
}

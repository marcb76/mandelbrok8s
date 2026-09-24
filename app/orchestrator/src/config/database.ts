// /src/config/database.ts - Configuration and connection management for the MongoDB database used by the Mandelbrok8s orchestrator application

// Import required modules
import { MongoClient, Db, Collection, GridFSBucket } from 'mongodb';




// Database connection and collection references
const bucketName = 'fractals';
let db: Db;
let globalConfigCollection: Collection;
let tasksCollection: Collection;
let gridFSBucket: GridFSBucket;
let isConnected = false;




// Connect to the MongoDB database and initialize collections and GridFS bucket... and seed global configuration if missing
export async function connectDB(mongoUri: string, defaultGlobalConfig: any): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  globalConfigCollection = db.collection(`global_config`);
  tasksCollection = db.collection(`tasks`);
  gridFSBucket = new GridFSBucket(db, { bucketName: bucketName });

  // If no global configuration exists, insert the default configuration
  const existingConfig = await globalConfigCollection.findOne({ _id: `global_config` as any });
  if (!existingConfig) {
    await globalConfigCollection.insertOne(defaultGlobalConfig);
    console.log('[DATABASE]   No existing global configuration found. Default global configuration inserted');
  }
  isConnected = true;
}




// Get the database and collection references
export function getDB() {
  return {
    db,
    globalConfigCollection,
    tasksCollection,
    gridFSBucket
  };
}




// Check if the database connection is established
export function checkDBConnection(): boolean {
  return isConnected;
}

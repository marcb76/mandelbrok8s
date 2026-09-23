// /src/config/database.ts - Configuration and connection management for the MongoDB database used by the Mandelbrok8s orchestrator application

// Import required modules
import { MongoClient, Db, Collection } from 'mongodb';




// Database connection and collection references
let db: Db;
let tasksCollection: Collection;
let configCollection: Collection;
let isConnected = false;




// Connect to the MongoDB database, initialize collections, and seed global configuration if missing
export async function connectDB(mongoUri: string, defaultConfig: any): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  tasksCollection = db.collection(`tasks`);
  configCollection = db.collection(`config`);

  // If no global configuration exists, insert the default configuration
  const existingConfig = await configCollection.findOne({ _id: `global_config` as any });
  if (!existingConfig)
    await configCollection.insertOne(defaultConfig);
  isConnected = true;
}




// Get the database and collection references
export function getDB() {
  return {
    db,
    tasksCollection,
    configCollection
  };
}




// Check if the database connection is established
export function checkDBConnection(): boolean {
  return isConnected;
}
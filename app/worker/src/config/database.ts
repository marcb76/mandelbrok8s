// /src/config/database.ts - Configuration and connection management for the MongoDB database used by the Mandelbrok8s worker application

// Import required modules
import { MongoClient, Db, Collection, GridFSBucket } from 'mongodb';




// Database connection and collection references
let db: Db;
let tasksCollection: Collection;
let configCollection: Collection;
let gridFSBucket: GridFSBucket;
let isConnected = false;




// Connect to the MongoDB database and initialize collections and GridFS bucket
export async function connectDB(mongoUri: string): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  tasksCollection = db.collection(`tasks`);
  configCollection = db.collection(`config`);
  gridFSBucket = new GridFSBucket(db, { bucketName: `fs` });
  isConnected = true;
}




// Get the database and collection references
export function getDB() {
  return {
    db,
    tasksCollection,
    configCollection,
    gridFSBucket
  };
}




// Check if the database connection is established
export function checkDBConnection(): boolean {
  return isConnected;
}

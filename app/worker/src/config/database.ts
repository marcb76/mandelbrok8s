// /src/config/database.ts - Configuration and connection management for the MongoDB database used by the Mandelbrok8s worker application

// Import required modules
import { MongoClient, Db, Collection, GridFSBucket } from 'mongodb';




// Database connection and collection references
const bucketName = 'fractals';
let db: Db;
let globalConfigCollection: Collection;
let tasksCollection: Collection;
let gridFSBucket: GridFSBucket;
let isConnected = false;




// Connect to the MongoDB database and initialize collections and GridFS bucket
export async function connectDB(mongoUri: string): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  globalConfigCollection = db.collection(`global_config`);
  tasksCollection = db.collection(`tasks`);
  gridFSBucket = new GridFSBucket(db, { bucketName: bucketName });
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

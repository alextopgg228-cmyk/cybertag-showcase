import "dotenv/config";
import { closePool, getDatabaseStats, initializeDatabase } from "../src/database.js";

try {
  await initializeDatabase();
  console.log(JSON.stringify(await getDatabaseStats()));
} finally {
  await closePool();
}

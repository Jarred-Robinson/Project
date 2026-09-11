import { DB_PATH, getDb } from "@rotation/db";

/** Ensure SQLite exists and demo users / catalog / roster are seeded. */
export function seed() {
  getDb();
}

if (process.argv[1]?.includes("seed")) {
  seed();
  console.log(`Rotation Engine SQLite ready at ${DB_PATH}`);
}

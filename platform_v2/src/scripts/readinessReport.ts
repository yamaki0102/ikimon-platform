import { getPool } from "../db.js";
import { getReadinessSnapshot } from "../services/readiness.js";

async function main() {
  try {
    const snapshot = await getReadinessSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await getPool().end();
  }
}

void main();

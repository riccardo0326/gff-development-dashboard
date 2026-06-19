#!/usr/bin/env node
/**
 * Smoke test: pending -> covered updates daily auto count.
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "gff.db");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const today = new Date().toISOString().slice(0, 10);

function openDb() {
  return new Database(DB_PATH);
}

function getAutoCount(db) {
  const covered = db
    .prepare(
      `SELECT COUNT(*) as c FROM coverage_changes
       WHERE stat_date = ? AND from_status = 'pending' AND to_status = 'covered'`,
    )
    .get(today).c;
  const reverted = db
    .prepare(
      `SELECT COUNT(*) as c FROM coverage_changes
       WHERE stat_date = ? AND from_status = 'covered' AND to_status = 'pending'`,
    )
    .get(today).c;
  return Math.max(0, covered - reverted);
}

async function main() {
  let db = openDb();
  const before = getAutoCount(db);

  const pending = db
    .prepare(
      `SELECT id, ecu_id FROM dtcs
       WHERE coverage_lb74x = 'pending'
       LIMIT 1`,
    )
    .get();
  db.close();

  if (!pending) {
    console.error("No pending DTC found for smoke test");
    process.exit(1);
  }

  console.log(`Using DTC ${pending.id} on ${pending.ecu_id}, auto before=${before}`);

  const coverRes = await fetch(
    `${BASE_URL}/api/ecus/${pending.ecu_id}/dtcs/${pending.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: "LB74x", status: "covered" }),
    },
  );

  if (!coverRes.ok) {
    console.error("PATCH covered failed", await coverRes.text());
    process.exit(1);
  }

  const coverPayload = await coverRes.json();
  db = openDb();
  const afterCover = getAutoCount(db);
  db.close();
  if (afterCover !== before + 1) {
    console.error(`Expected auto ${before + 1}, got ${afterCover}`);
    process.exit(1);
  }

  console.log("Covered transition OK", coverPayload.dailyUpdate);

  const revertRes = await fetch(
    `${BASE_URL}/api/ecus/${pending.ecu_id}/dtcs/${pending.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: "LB74x", status: "pending" }),
    },
  );

  if (!revertRes.ok) {
    console.error("PATCH revert failed", await revertRes.text());
    process.exit(1);
  }

  db = openDb();
  const afterRevert = getAutoCount(db);
  db.close();
  if (afterRevert !== before) {
    console.error(`Expected auto back to ${before}, got ${afterRevert}`);
    process.exit(1);
  }

  console.log("Smoke test passed: auto daily count increments and reverts correctly.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

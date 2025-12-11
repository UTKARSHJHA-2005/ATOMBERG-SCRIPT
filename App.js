/**
 * BATTERY LEVEL CAMPAIGN SCRIPT
 * This script supports:
 *  - REAL DynamoDB + PostgreSQL connections
 *                   OR 
 *  - getbacks to MOCK data if no DB exists 
 */
import AWS from "aws-sdk"; // DynamoDB Client
import { Pool } from "pg"; // PostgreSQL Client

const POSTGRES_URL = process.env.POSTGRES_URL || "";
const USE_REAL_DB = POSTGRES_URL !== "";
const REGION = "ap-south-1";
const LOCKS_TABLE = "locks";
const CAMPAIGN_TAG = `battery_check_${new Date().toISOString().slice(0, 10)}`;
// LOG CAMPAIGN DETAILS
console.log("=======================================");
console.log(" BATTERY CHECK CAMPAIGN SCRIPT");
console.log(" DB Mode:", USE_REAL_DB ? "REAL" : "MOCK");
console.log(" Campaign:", CAMPAIGN_TAG);
console.log("=======================================\n");

// PostgreSQL Client
let pool = null;
if (USE_REAL_DB) {
  pool = new Pool({ connectionString: POSTGRES_URL });
}

// DynamoDB Client
let dynamo = null;
if (USE_REAL_DB) {
  AWS.config.update({ region: REGION });
  dynamo = new AWS.DynamoDB.DocumentClient();
}

// MOCK DATA (Used only when DB connections are not provided)
const mockLocks = [
  { lock_id: "L001", last_battery_check: "2023-12-01T00:00:00Z" },
  { lock_id: "L002", last_battery_check: "2024-01-10T00:00:00Z" }
];

const mockUsers = {
  L001: [
    { user_id: "U001", fcm_id: "token_111" },
    { user_id: "U002", fcm_id: "token_222" }
  ],
  L002: [{ user_id: "U003", fcm_id: "token_333" }]
};

// store notification metrics
const notificationsSent = [];
const notificationsOpened = [];

// GET LOCKS NOT CHECKED IN ≥ 30 DAYS]
async function getLocksNotCheckedInMonth() {
  console.log("→ Fetching locks not checked ≥ 1 month...");
  if (!USE_REAL_DB) {
    console.log("→ Using MOCK DynamoDB data.");
    return filterStaleLocks(mockLocks);
  }
  try {
    const result = await dynamo.scan({ TableName: LOCKS_TABLE }).promise();
    return filterStaleLocks(result.Items);
  } catch (err) {
    console.log("⚠ DynamoDB connection failed. Using MOCK data instead.");
    return filterStaleLocks(mockLocks);
  }
}

function filterStaleLocks(lockList) {
  const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return lockList.filter(lock =>
    new Date(lock.last_battery_check).getTime() < oneMonthAgo
  );
}

// GET USERS FOR A LOCK
async function getUsersForLock(lockId) {
  if (!USE_REAL_DB) {
    console.log(`→ Using MOCK user mappings for lock ${lockId}`);
    return mockUsers[lockId] || [];
  }

  try {
    const result = await pool.query(
      "SELECT user_id, fcm_id FROM lock_user_mapping WHERE lock_id=$1",
      [lockId]
    );
    return result.rows;
  } catch (err) {
    console.log("⚠ PostgreSQL error. Using MOCK users instead.");
    return mockUsers[lockId] || [];
  }
}

// SEND NOTIFICATION
function sendMockNotification(user, lockId) {
  console.log(`🔸 Would send notification to user ${user.user_id} for lock ${lockId}`);

  notificationsSent.push({
    user_id: user.user_id,
    lock_id: lockId,
    campaign_tag: CAMPAIGN_TAG,
    sent_at: new Date().toISOString()
  });
}

// MOCK USER CLICK
function mockUserClicked(userId, lockId) {
  console.log(`✓ MOCK CLICK → user ${userId} clicked notification`);
  notificationsOpened.push({
    user_id: userId,
    lock_id: lockId,
    campaign_tag: CAMPAIGN_TAG,
    opened_at: new Date().toISOString()
  });
}

// MEASURE CAMPAIGN EFFECTIVENESS
function calculateEffectiveness() {
  const sent = notificationsSent.length;
  const opened = notificationsOpened.length;
  return {
    campaign_tag: CAMPAIGN_TAG,
    notifications_sent: sent,
    notifications_opened: opened,
    open_rate: ((opened / sent) * 100).toFixed(2) + "%",
    interpretation:
      opened === 0 ? "Low engagement" : "Users are engaging with notifications"
  };
}

// MAIN EXECUTION
async function main() {
  const staleLocks = await getLocksNotCheckedInMonth();

  for (const lock of staleLocks) {
    const users = await getUsersForLock(lock.lock_id);

    for (const user of users) {
      sendMockNotification(user, lock.lock_id);
    }
  }

  console.log("\nSimulating notification clicks...");
  mockUserClicked("U001", "L001");
  mockUserClicked("U003", "L002");

  console.log("\n==============================");
  console.log(" CAMPAIGN EFFECTIVENESS");
  console.log("==============================");
  console.log(calculateEffectiveness());
}

main();
// Code by Utkarsh Jha

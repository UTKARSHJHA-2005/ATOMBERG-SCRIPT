// This is the Node.js script of the Battery FCM Notification 
import AWS from "aws-sdk";
import { Pool } from "pg";
import admin from "firebase-admin";
import fs from "fs";

const POSTGRES_URL = "";// Replace with PostgreSQL connection string
const USE_REAL_DB = POSTGRES_URL !== "";
const AWS_ACCESS_KEY_ID = ""; // Replace with AWS Access Key ID
const AWS_SECRET_ACCESS_KEY = ""; // Replace with AWS Secret Access Key
const REGION = "ap-south-1";

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY
});

const LOCKS_TABLE = "locks";
const CAMPAIGN_TAG = `battery_check_${new Date().toISOString().slice(0, 10)}`;

const FIREBASE_KEY_PATH = "./firebase-service-account.json"; // Replace the path 
const USE_REAL_FCM = fs.existsSync(FIREBASE_KEY_PATH);

console.log("=======================================");
console.log(" BATTERY CHECK CAMPAIGN SCRIPT");
console.log(" DB Mode:", USE_REAL_DB ? "REAL" : "MOCK");
console.log(" FCM Mode:", USE_REAL_FCM ? "REAL FCM" : "MOCK FCM");
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

// Firebase FCM Client
if (USE_REAL_FCM) {
  const serviceAccount = require(FIREBASE_KEY_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const notificationsSent = [];
const notificationsOpened = [];

// GET LOCKS NOT CHECKED IN ≥ 30 DAYS
async function getLocksNotCheckedInMonth() {
  console.log("→ Fetching locks not checked ≥ 1 month...");

  const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  if (!USE_REAL_DB) {
    console.log("→ Using MOCK DynamoDB data.");
    return mockLocks.filter(lock => new Date(lock.last_battery_check).getTime() < oneMonthAgo);
  }
  try {
    const result = await dynamo.scan({ TableName: LOCKS_TABLE }).promise();
    return result.Items.filter(lock => new Date(lock.last_battery_check).getTime() < oneMonthAgo);
  } catch (err) {
    console.log("⚠ DynamoDB connection failed → using MOCK data.");
    return mockLocks.filter(lock => new Date(lock.last_battery_check).getTime() < oneMonthAgo);
  }
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
    console.log("⚠ PostgreSQL error → using MOCK data.");
    return mockUsers[lockId] || [];
  }
}

// SEND REAL FCM NOTIFICATION
async function sendRealNotification(token, lockId, userId) {
  const message = {
    token,
    notification: {
      title: "Battery Check Reminder",
      body: "You haven’t checked your lock’s battery level in a while."
    },
    data: {
      campaign_tag: CAMPAIGN_TAG,
      lock_id: lockId,
      user_id: userId
    }
  };

  try {
    const messageId = await admin.messaging().send(message);
    console.log("✓ REAL FCM sent:", messageId);
    return messageId;
  } catch (err) {
    console.error("FCM Error:", err);
    return null;
  }
}

// LOG METRICS
function recordSent(userId, lockId, msgId) {
  notificationsSent.push({
    user_id: userId,
    lock_id: lockId,
    fcm_message_id: msgId,
    campaign_tag: CAMPAIGN_TAG,
    sent_at: new Date().toISOString()
  });
}

// CALCULATE EFFECTIVENESS
function calculateEffectiveness() {
  const sent = notificationsSent.length;
  const opened = notificationsOpened.length;

  return {
    campaign_tag: CAMPAIGN_TAG,
    notifications_sent: sent,
    notifications_opened: opened,
    open_rate: sent ? ((opened / sent) * 100).toFixed(2) + "%" : "0%",
    summary:
      opened === 0
        ? "Low engagement — users are not responding."
        : "Good engagement — users are clicking notifications."
  };
}

// MAIN
async function main() {
  const staleLocks = await getLocksNotCheckedInMonth();

  for (const lock of staleLocks) {
    const users = await getUsersForLock(lock.lock_id);

    for (const user of users) {
      let msgId;

      if (USE_REAL_FCM) {
        msgId = await sendRealNotification(user.fcm_id, lock.lock_id, user.user_id);
      } else {
        msgId = sendMockNotification(user, lock.lock_id);
      }

      if (msgId) recordSent(user.user_id, lock.lock_id, msgId);
    }
  }

  console.log("\nSimulating some user clicks...");
  mockUserClicked("U001", "L001");
  mockUserClicked("U003", "L002");

  console.log("\n==============================");
  console.log(" CAMPAIGN EFFECTIVENESS");
  console.log("==============================");
  console.log(calculateEffectiveness());
}

main();
// Code by Utkarsh Jha

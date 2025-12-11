# BATTERY LEVEL NOTIFICATION
This is the Node.js script that sends an FCM notification to all users who haven’t checked their lock’s battery level in the last 1 month.<br/>
This script: <br/>
✔ Detects locks whose battery hasn't been checked for > 1 month  <br/>
✔ Fetches users linked to those locks  <br/>
✔ Sends push notifications (REAL FCM) 
✔ Tracks notifications sent  <br/>
✔ Tracks notifications opened  <br/>
✔ Computes campaign effectiveness weekly <br/>
<br/>
<strong>Requirements</strong><br/>
- Node.js 16+ <br/>
- AWS credentials <br/>
- PostgreSQL DB <br/>
- Firebase service account JSON <br/>
<br/>
<strong>How to run</strong><br/>
1. Use Firebase service account JSON <br/>
- Go to https://console.firebase.google.com/ <br/>
- Select your Firebase project <br/>
- Go to **Project Settings** <br/>
- Open the **Service Accounts** tab <br/>
- Click **Generate New Private Key** <br/>
- Download the `.json` file <br/>
- Place it as firebase-service-account.json in the project root, and if you want to change the name of json file, then change line 20 of App.js. <br/>
2. Use PostgreSQL <br/>
- Set POSTGRES_URL="postgresql://user:password@host:5432/dbname" at line 6 in App.js. <br/>
3. Use DynamoDB <br/>
- Ensure AWS credentials are set: <br/>
   AWS_ACCESS_KEY_ID=xxxx at line 8 <br/>
   AWS_SECRET_ACCESS_KEY=yyyy at line 9 <br/>
   AWS_REGION=ap-south-1, take this as the region. <br/>
4. Run the script <br/>
  node App.js

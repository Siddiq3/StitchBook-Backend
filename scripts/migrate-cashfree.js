// Explicit operator command. Startup never applies these payment-provider migration.
require('dotenv').config();
const fs=require('fs');
const path=require('path');
const db=require('../src/config/database');
const {transaction}=require('../src/models/billingLedger');
transaction(client=>client.query(fs.readFileSync(path.join(__dirname,'../src/migrations/014_cashfree.sql'),'utf8')))
  .then(()=>console.log('Cashfree migration applied'))
  .catch(error=>{console.error('Migration failed:',error.code||error.name);process.exitCode=1;})
  .finally(()=>db.pool.end());

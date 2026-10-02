require('dotenv').config();
const fs=require('fs');
const path=require('path');
const db=require('../src/config/database');

db.query(fs.readFileSync(path.join(__dirname,'../src/migrations/013_password_auth.sql'),'utf8'))
  .then(()=>console.log('Password auth migration applied'))
  .catch(error=>{console.error('Migration failed:',error.code||error.name);process.exitCode=1;})
  .finally(()=>db.pool.end());

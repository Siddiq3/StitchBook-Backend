const test=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.JWT_SECRET='test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET='test-refresh-secret-not-for-production';
const redis=require('../src/config/redis').client;
redis.disconnect();
const db=require('../src/config/database');
const app=require('../src/app');
let server,base;
test.before(async()=>{
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  base=`http://127.0.0.1:${server.address().port}`;
});
test('health and liveness respond without a dependency query',async t=>{
  const query=t.mock.method(db.pool,'query',()=>{throw new Error('Database must not be called');});
  for(const route of ['/health','/live']) {const result=await fetch(base+route);assert.equal(result.status,200);assert.equal((await result.json()).status,'OK');}
  assert.equal(query.mock.callCount(),0);
});
test('readiness returns a safe dependency failure and caches repeated probes',async t=>{
  const query=t.mock.method(db.pool,'query',async()=>{throw new Error('private database details');});
  for(let count=0;count<3;count++) {const result=await fetch(base+'/ready');assert.equal(result.status,503);assert.deepEqual(await result.json(),{status:'NOT_READY'});}
  assert.equal(query.mock.callCount(),1);
});
test('unapproved origins and unauthenticated tenant resource access are refused',async()=>{
  const cors=await fetch(base+'/api/user/profile',{headers:{Origin:'https://attacker.example'}});
  assert.ok(cors.status>=400);assert.equal(cors.headers.get('access-control-allow-origin'),null);
  assert.equal((await fetch(base+'/api/customer')).status,401);
  assert.equal((await fetch(base+'/uploads/1/secret.png')).status,404);
});
test.after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.pool.end();});

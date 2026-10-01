const test=require('node:test');
const assert=require('node:assert/strict');
const enabled=Boolean(process.env.TEST_REDIS_URL);
if(enabled){
  const url=new URL(process.env.TEST_REDIS_URL);
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Redis integration tests require an isolated local Redis instance');
  process.env.REDIS_URL=process.env.TEST_REDIS_URL;
  process.env.REDIS_TLS='false';
}
process.env.NODE_ENV='test';
process.env.REDIS_KEY_PREFIX=`test-hardening-${process.pid}:`;
process.env.JWT_SECRET='test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET='test-refresh-secret-not-for-production';
process.env.MSG91_WIDGET_ID='test-widget';
process.env.MSG91_WIDGET_TOKEN_AUTH='test-only-config';
const {client}=require('../src/config/redis');
if(!enabled)client.disconnect();
const sessions=require('../src/services/session.service');
const otp=require('../src/services/msg91Widget.service');
const integration=(name,callback)=>test(name,{skip:!enabled},callback);
test.before(async()=>{if(enabled&&client.status!=='ready')await new Promise((resolve,reject)=>{client.once('ready',resolve);client.once('error',reject);});});
integration('refresh rotation on a shared connection admits one request and rejects replay',async()=>{
  const session=await sessions.createSession({sessionId:'rotation',userId:1,refreshJti:'old'});
  const results=await Promise.allSettled([sessions.rotateRefreshToken(session.sessionId,'old','new-1'),sessions.rotateRefreshToken(session.sessionId,'old','new-2')]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected').length,1);
  assert.equal(await sessions.getSession('rotation'),null);
});
integration('large session cleanup is bounded and safely resumable',async()=>{
  for(let index=0;index<251;index++)await sessions.createSession({sessionId:`device-${index}`,userId:2,refreshJti:`jti-${index}`});
  const first=await sessions.revokeSessionBatch(2);assert.ok(first.revoked<=100);assert.ok(first.remaining>0);
  await assert.rejects(sessions.listSessionsForUser(2), /Too many device sessions/);
  let remaining=first.remaining;
  for(let batch=0;batch<10&&remaining;batch++)remaining=(await sessions.revokeSessionBatch(2)).remaining;
  assert.equal(remaining,0);assert.equal(await sessions.getSession('device-250'),null);
});
integration('OTP send cooldown and attempt ceiling stop repeated provider calls',async t=>{
  const axios=require('axios');
  let verifyCalls=0;
  t.mock.method(axios,'post',async url=>{
    if(url.endsWith('/sendOtpMobile'))return {data:{type:'success',message:'request-1'}};
    verifyCalls++;return {data:{type:'error',message:'bad code'}};
  });
  await otp.sendMobileOtp('9876543210');
  await assert.rejects(otp.sendMobileOtp('9876543210'),/wait/);
  for(let attempt=0;attempt<6;attempt++)await assert.rejects(otp.verifyMobileOtp('request-1','000000'));
  assert.equal(verifyCalls,5);
});
integration('successful OTP is single use',async t=>{
  const axios=require('axios');
  t.mock.method(axios,'post',async url=>({data:url.endsWith('/sendOtpMobile')?{type:'success',message:'request-2'}:{type:'success'}}));
  await otp.sendMobileOtp('9876543211');
  assert.equal((await otp.verifyMobileOtp('request-2','123456')).mobile,'+919876543211');
  await assert.rejects(otp.verifyMobileOtp('request-2','123456'),/Invalid or expired/);
});
test.after(async()=>{if(enabled)await client.quit();});

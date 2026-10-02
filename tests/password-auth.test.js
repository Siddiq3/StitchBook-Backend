const test=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.JWT_SECRET='test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET='test-refresh-secret-not-for-production';

const bcrypt=require('bcryptjs');
const AuthService=require('../src/services/auth.service');
const UserModel=require('../src/models/user.model');
const ShopModel=require('../src/models/shop.model');
const StaffModel=require('../src/models/staff.model');
const SessionService=require('../src/services/session.service');
const TokenService=require('../src/services/token.service');
require('../src/config/redis').client.disconnect();

function mockLoginDependencies(t){
  t.mock.method(ShopModel,'getShopByUserId',async()=>null);
  t.mock.method(StaffModel,'getStaffByUserId',async()=>null);
  t.mock.method(StaffModel,'getStaffByEmail',async()=>null);
  t.mock.method(StaffModel,'getStaffByPhone',async()=>null);
  t.mock.method(SessionService,'createSession',async()=>{});
  t.mock.method(TokenService,'generateTokenPair',()=>({accessToken:'access',refreshToken:'refresh',refreshJti:'r1',expiresIn:900}));
}

test('password signup stores normalized email/mobile and a bcrypt hash',async t=>{
  mockLoginDependencies(t);
  let created;
  t.mock.method(UserModel,'getUserByEmail',async()=>null);
  t.mock.method(UserModel,'getUserByPhone',async()=>null);
  t.mock.method(UserModel,'createPasswordUser',async input=>{
    created=input;
    return {id:7,name:input.name,email:input.email,phone:input.phone,auth_provider:'password'};
  });
  const result=await AuthService.registerWithPassword({
    name:'  Tailor Owner  ',
    email:'OWNER@EXAMPLE.COM',
    phone:'9876543210',
    password:'stitch123',
  });
  assert.equal(created.name,'Tailor Owner');
  assert.equal(created.email,'owner@example.com');
  assert.equal(created.phone,'+919876543210');
  assert.equal(await bcrypt.compare('stitch123',created.passwordHash),true);
  assert.equal(result.user.email,'owner@example.com');
});

test('password login accepts email or normalized mobile and keeps invalid credentials generic',async t=>{
  mockLoginDependencies(t);
  const hash=await bcrypt.hash('stitch123',12);
  const user={id:9,name:'Owner',email:'owner@example.com',phone:'+919876543210',password_hash:hash,auth_provider:'password'};
  const seen=[];
  t.mock.method(UserModel,'getUserForPasswordLogin',async identifier=>{seen.push(identifier);return user;});
  t.mock.method(UserModel,'updateUser',async(_id,update)=>({...user,...update}));
  await AuthService.loginWithPassword('OWNER@EXAMPLE.COM','stitch123');
  await AuthService.loginWithPassword('9876543210','stitch123');
  assert.deepEqual(seen,['owner@example.com','+919876543210']);
  await assert.rejects(()=>AuthService.loginWithPassword('owner@example.com','wrong'),error=>error.code==='INVALID_CREDENTIALS'&&error.message==='Invalid email/mobile number or password');
});

test('legacy signed-in account can set its first password; later changes require current password and revoke other sessions',async t=>{
  let savedHash=null;
  const revoked=[];
  t.mock.method(UserModel,'getPasswordHash',async()=>savedHash);
  t.mock.method(UserModel,'setPasswordHash',async(_id,hash)=>{
    savedHash=hash;
    return {id:11,name:'Legacy',email:'legacy@example.com',phone:'+919876543210',auth_provider:'google_password'};
  });
  t.mock.method(ShopModel,'getShopByUserId',async()=>null);
  t.mock.method(StaffModel,'getStaffByUserId',async()=>null);
  t.mock.method(SessionService,'listSessionsForUser',async()=>[
    {sessionId:'current'},
    {sessionId:'other-1'},
    {sessionId:'other-2'},
  ]);
  t.mock.method(SessionService,'revokeSession',async id=>{revoked.push(id);});

  await AuthService.setOrChangePassword(11,{newPassword:'first123'},'current');
  assert.equal(await bcrypt.compare('first123',savedHash),true);
  assert.deepEqual(revoked,['other-1','other-2']);

  await assert.rejects(()=>AuthService.setOrChangePassword(11,{currentPassword:'wrong',newPassword:'second123'},'current'),error=>error.code==='INVALID_CURRENT_PASSWORD');
  await AuthService.setOrChangePassword(11,{currentPassword:'first123',newPassword:'second123'},'current');
  assert.equal(await bcrypt.compare('second123',savedHash),true);
});

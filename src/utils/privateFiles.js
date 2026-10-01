const crypto=require('crypto');
const {JWT_SECRET}=require('../config/env');
function safeFile(shopId,filename){return /^[1-9]\d*$/.test(String(shopId))&&/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/.test(String(filename));}
function signature(shopId,filename,expires){return crypto.createHmac('sha256',JWT_SECRET).update(`${shopId}/${filename}:${expires}`).digest('hex');}
function signFile(shopId,filename,now=Date.now()){
  if(!safeFile(shopId,filename)) throw new Error('File not found');
  const expires=Math.floor(now/1000)+300;
  return {expires,signature:signature(shopId,filename,expires)};
}
function verifyFile(shopId,filename,expires,sig,now=Date.now()){
  if(!safeFile(shopId,filename)||!Number.isInteger(Number(expires))||Number(expires)<=now/1000||Number(expires)>now/1000+300) return false;
  const expected=Buffer.from(signature(shopId,filename,expires));
  const received=Buffer.from(String(sig||''));
  return expected.length===received.length&&crypto.timingSafeEqual(expected,received);
}
function isImage(buffer,mime){
  if(mime==='image/png') return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/jpeg') return buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
  if(mime==='image/gif') return ['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString());
  if(mime==='image/webp') return buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
  return false;
}
module.exports={safeFile,signFile,verifyFile,isImage};

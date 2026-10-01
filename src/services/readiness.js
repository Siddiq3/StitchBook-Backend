function createReadinessProbe({ checkDatabase, checkRedis, now = Date.now, ttl = 5000 }) {
  let cached;
  let expires=0;
  let pending;
  return async () => {
    if(cached&&now()<expires) return cached;
    if(pending) return pending;
    pending=(async()=>{
      let ready=false;
      try{await checkDatabase();ready=Boolean(checkRedis());}catch{ready=false;}
      cached={status:ready?'READY':'NOT_READY'};
      expires=now()+ttl;
      return cached;
    })().finally(()=>{pending=null;});
    return pending;
  };
}
module.exports={createReadinessProbe};

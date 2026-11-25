/* Realtime rooms for Rise of Fire online play (polling over the normal /api endpoint, state in Redis).
   Ops: rjoin (enter a room), rsync (heartbeat + send events + receive events), rleave.
   A peer id is "<username>.<random>", so the server can check who is sending without a lookup. */
const crypto=require('crypto');
const STALE=20000,TTL=10800,MAXPEERS=8,MAXOUT=60,MAXBYTES=250000,MAXLIST=20000,MAXGET=200;
const CODE=/^[a-z0-9]{3,16}$/,EVN=/^[a-z]{1,12}$/;

module.exports=function(r){
 const now=()=>Date.now(),err=(s,e)=>({s,o:{error:e}}),good=o=>({s:200,o});
 const PK=c=>'rm:p:'+c,EK=c=>'rm:e:'+c,SK=c=>'rm:s:'+c;
 /* Upstash may hand back parsed objects or raw strings depending on what was stored */
 const J=v=>{if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return null}}return v};
 const mine=(peer,me)=>typeof peer==='string'&&peer.length<=48&&peer.startsWith(me.uid+'.');

 function livePeers(h,t,dead){
  const out=[];
  for(const id of Object.keys(h||{})){
   const v=J(h[id]);
   if(!v||t-v.s>STALE){dead.push(id);continue}
   out.push({peer:id,presence:v.pr||{},jt:v.j||0})}
  out.sort((a,b)=>a.jt-b.jt||(a.peer<b.peer?-1:1));
  return out}

 async function join(b,me){
  const code=String(b.code||'');if(!CODE.test(code))return err(400,'Bad room code');
  const t=now(),dead=[],live=livePeers(await r.hgetall(PK(code)),t,dead);
  if(live.length>=MAXPEERS)return err(409,'That room is full');
  const peer=me.uid+'.'+crypto.randomBytes(3).toString('hex');
  const p=r.pipeline();
  if(dead.length)p.hdel(PK(code),...dead);
  if(!live.length){p.del(EK(code));p.del(SK(code))}   /* fresh room: drop leftovers from an old game */
  p.hset(PK(code),{[peer]:{u:me.uid,pr:{},s:t,j:t}});
  p.expire(PK(code),TTL);
  p.llen(EK(code));
  const res=await p.exec();
  const cur=+res[res.length-1]||0;
  return good({peer,cur,jt:t,peers:live.concat([{peer,presence:{},jt:t}])})}

 async function sync(b,me){
  const code=String(b.code||'');if(!CODE.test(code))return err(400,'Bad room code');
  if(!mine(b.peer,me))return err(400,'Bad peer');
  const peer=b.peer,t=now(),p=r.pipeline();
  let n=0;const add=()=>{n++};

  /* presence / heartbeat (the client only sends it when it changed or every few seconds) */
  if(b.pres&&typeof b.pres==='object'){
   const s=JSON.stringify(b.pres);if(s.length>1000)return err(400,'Presence too large');
   const j=Math.min(t,Math.max(0,+b.jt||t));
   p.hset(PK(code),{[peer]:{u:me.uid,pr:JSON.parse(s),s:t,j}});add();
   p.expire(PK(code),TTL);add()}

  /* outgoing events: "snap" is latest-wins state, everything else is an ordered log */
  if(Array.isArray(b.out)&&b.out.length){
   if(b.out.length>MAXOUT)return err(400,'Too many events');
   const raw=JSON.stringify(b.out);if(raw.length>MAXBYTES)return err(413,'Event too large');
   const log=[],snaps=[];
   for(const o of b.out){
    if(!o||!EVN.test(String(o.e)))continue;
    if(o.e==='snap'){if(o.d&&typeof o.d==='object')snaps.push(o.d)}
    else log.push(JSON.stringify({p:peer,e:o.e,d:o.d===undefined?null:o.d}))}
   if(log.length){p.rpush(EK(code),...log);add();p.expire(EK(code),TTL);add()}
   if(snaps.length){
    const id=snaps[snaps.length-1].id;
    p.set(SK(code),{id,peer,ch:snaps.filter(x=>x.id===id)},{ex:300});add()}}

  /* reads */
  const cur=Math.max(0,Math.floor(+b.cur||0));
  p.hgetall(PK(code));const iP=n++;
  p.lrange(EK(code),cur,cur+MAXGET-1);const iE=n++;
  let iS=-1;if(b.g){p.get(SK(code));iS=n++}
  const res=await p.exec();

  const dead=[],peers=livePeers(res[iP],t,dead);
  if(dead.length)await r.hdel(PK(code),...dead);
  const raw=Array.isArray(res[iE])?res[iE]:[],ev=[];
  for(const x of raw){const e=J(x);if(e&&e.p!==peer)ev.push(e)}
  const out={cur:cur+raw.length,peers,ev};
  if(iS>=0){const s=J(res[iS]);if(s&&s.id!==b.ss&&s.peer!==peer)out.snap=s}
  return good(out)}

 async function leave(b,me){
  const code=String(b.code||'');if(!CODE.test(code)||!mine(b.peer,me))return err(400,'Bad request');
  await r.hdel(PK(code),b.peer);return good({ok:true})}

 async function handle(op,b,me){
  if(op==='rjoin')return join(b,me);
  if(op==='rsync')return sync(b,me);
  if(op==='rleave')return leave(b,me);
  return err(400,'Unknown action')}
 return{ops:['rjoin','rsync','rleave'],handle}
};

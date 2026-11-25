/* GASNITE (games/gasnite/) online data: cloud saves, each player's public GASNITE card (skin, level, wins, kills)
   and their party list. Accounts, friends and the online list are the site's own (api/index.js), so GASNITE signs in
   with the same token and shows the same friends.
   Ops: gnme (friends + requests + party + cloud save time), gnload, gnsave, gnparty. */
const MAXSAVE=200000,ONLINE=50000;

module.exports=function(r){
 const now=()=>Date.now(),err=(s,e,x)=>({s,o:Object.assign({error:e},x||{})}),good=o=>({s:200,o});
 const SK=u=>'gn:save:'+u,AK=u=>'gn:at:'+u,PK=u=>'gn:prof:'+u,QK=u=>'gn:party:'+u;
 /* Upstash may hand back parsed objects or raw strings depending on what was stored */
 const J=v=>{if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return null}}return v};
 const num=(x,lo,hi)=>Math.min(hi,Math.max(lo,Math.floor(+x||0)));
 const color=c=>/^#[0-9a-f]{3,8}$/i.test(c||'')?c:'';
 /* documents use the same layout as api/index.js: 'd:<collection>/<id>' plus the index zset 'i:<collection>' */
 async function docs(coll){
  const ids=await r.zrange('i:'+coll,0,399,{rev:true});if(!ids.length)return[];
  const v=await r.mget(...ids.map(i=>'d:'+coll+'/'+i));
  return ids.map((id,i)=>({id,d:J(v[i])})).filter(x=>x.d)}
 async function friendsOf(u){return[...new Set((await docs('fs')).filter(x=>x.d.a===u||x.d.b===u).map(x=>x.d.a===u?x.d.b:x.d.a))]}
 function card(p){p=p||{};return{outfit:/^outfit_\d{1,4}$/.test(p.outfit||'')?p.outfit:'',level:num(p.level,1,1e6),wins:num(p.wins,0,1e9),kills:num(p.kills,0,1e9),t:now()}}

 async function me(b,m){
  const [ids,reqs,at,party,mine]=await Promise.all([friendsOf(m.uid),docs('fr'),r.get(AK(m.uid)),r.get(QK(m.uid)),r.get('d:profiles/'+m.uid)]);
  let friends=[];
  if(ids.length){
   const n=ids.length,v=await r.mget(...ids.map(i=>'d:profiles/'+i),...ids.map(i=>'d:presence/'+i),...ids.map(PK));
   friends=ids.map((id,i)=>{const p=J(v[i])||{},pr=J(v[n+i]),g=J(v[2*n+i])||{};
    return{uid:id,name:p.name||id,e:String(p.emoji||'').slice(0,8),c:color(p.color),i:String(p.img||'').slice(0,60),
     online:!!pr&&now()-(+pr.t||0)<ONLINE,at:pr?String(pr.at||'').slice(0,20):'',outfit:g.outfit||'',level:g.level||0,wins:g.wins||0,kills:g.kills||0}})}
  const rq=reqs.map(x=>x.d).filter(x=>x.to===m.uid||x.from===m.uid),pl=J(party),mp=J(mine)||{};
  return good({uid:m.uid,name:m.name,at:+J(at)||0,me:{e:String(mp.emoji||'').slice(0,8),c:color(mp.color),i:String(mp.img||'').slice(0,60)},friends,
   in:rq.filter(x=>x.to===m.uid).map(x=>({uid:x.from,name:x.fromName||x.from,e:String(x.e||'').slice(0,8),c:color(x.c),i:String(x.i||'').slice(0,60)})),
   out:rq.filter(x=>x.from===m.uid).map(x=>({uid:x.to,name:x.toName||x.to})),
   party:(Array.isArray(pl)?pl:[]).filter(x=>ids.includes(x)).slice(0,3)})}

 async function load(b,m){const [s,at]=await Promise.all([r.get(SK(m.uid)),r.get(AK(m.uid))]);return good({save:J(s)||null,at:+J(at)||0})}

 async function save(b,m){
  if(!b.state||typeof b.state!=='object'||Array.isArray(b.state))return err(400,'Bad save');
  const txt=JSON.stringify(b.state);if(txt.length>MAXSAVE)return err(413,'Save is too big');
  const cur=+J(await r.get(AK(m.uid)))||0;
  /* "base" is the cloud version this save grew from: if another device saved since then, let the game decide */
  if(b.base!==undefined&&b.base!==null&&cur>(+b.base||0))return err(409,'conflict',{at:cur});
  const t=Math.max(now(),cur+1);
  await Promise.all([r.set(SK(m.uid),txt),r.set(AK(m.uid),t),r.set(PK(m.uid),card(b.profile))]);
  return good({at:t})}

 async function party(b,m){
  const ids=await friendsOf(m.uid);
  const pl=[...new Set((Array.isArray(b.list)?b.list:[]).map(x=>String(x).toLowerCase()))].filter(x=>ids.includes(x)).slice(0,3);
  await r.set(QK(m.uid),JSON.stringify(pl));return good({party:pl})}

 async function handle(op,b,m){
  if(op==='gnme')return me(b,m);
  if(op==='gnload')return load(b,m);
  if(op==='gnsave')return save(b,m);
  if(op==='gnparty')return party(b,m);
  return err(400,'Unknown action')}
 return{ops:['gnme','gnload','gnsave','gnparty'],handle}
};

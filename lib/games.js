/* Server-authoritative challenge games: chess and blackjack duel.
   Escrow: both players' wagers are taken when the challenge is accepted and paid out when it ends. */
const crypto=require('crypto');
const C=require('../chess-engine.js');
const SUITS=['\u2660','\u2665','\u2666','\u2663'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const EXPIRE=600000,IDLE=600000,MAXW=1000000;
function newDeck(){const d=[];for(const s of SUITS)for(const r of RANKS)d.push(r+s);
 for(let i=d.length-1;i>0;i--){const j=crypto.randomInt(i+1);[d[i],d[j]]=[d[j],d[i]]}return d}
function total(h){let t=0,a=0;for(const c of h){const r=c.slice(0,-1);
 if(r==='A'){a++;t+=11}else if(r==='J'||r==='Q'||r==='K'||r==='10')t+=10;else t+=+r}
 while(t>21&&a){t-=10;a--}return t}
const rank=h=>{const t=total(h);return t>21?-1:(h.length===2&&t===21?22:t)};

module.exports=function(r){
 const now=()=>Date.now(),GK=id=>'g:'+id,UK=u=>'ug:'+u;
 const err=(s,e)=>({s,o:{error:e}}),good=o=>({s:200,o});
 const other=(g,u)=>u===g.a?g.b:g.a;
 async function getBal(u){const p=await r.get('d:profiles/'+u);return Math.floor((p&&p.balance)||0)}
 async function addBal(u,d){const k='d:profiles/'+u,p=(await r.get(k))||{};p.balance=Math.max(0,Math.floor((p.balance||0)+d));await r.set(k,p)}
 async function save(g){g.u=now();await r.set(GK(g.id),g,{ex:604800});
  await r.zadd(UK(g.a),{score:g.u,member:g.id});await r.zadd(UK(g.b),{score:g.u,member:g.id})}
 function turnUid(g){if(g.st!=='active')return '';
  if(g.type==='bj')return g.turn;
  return g.fen.split(' ')[1]==='w'?g.w:other(g,g.w)}
 function view(g,me){
  const o={id:g.id,type:g.type,a:g.a,b:g.b,an:g.an,bn:g.bn,wager:g.wager,st:g.st,t:g.t,u:g.u,win:g.win||'',why:g.why||'',tu:turnUid(g)};
  if(g.type==='chess'){o.w=g.w||'';o.fen=g.fen||'';o.mv=g.mv||[];o.sn=g.sn||[];o.draw=g.draw||'';o.cc=g.cc}
  else if(g.st==='active'||g.st==='done'){
   const mine=me===g.a?g.ha:g.hb,theirs=me===g.a?g.hb:g.ha;
   o.me=mine;o.tot=total(mine);o.oc=theirs.length;o.ms=me===g.a?g.sa:g.sb;o.os=me===g.a?g.sb:g.sa;
   if(g.st==='done'){o.ho=theirs;o.ot=total(theirs)}}
  return o}
 async function finish(g,winner,why){
  g.st='done';g.win=winner||'draw';g.why=why;g.draw='';
  if(g.wager>0){if(winner)await addBal(winner,g.wager*2);else{await addBal(g.a,g.wager);await addBal(g.b,g.wager)}}}
 function bjAdvance(g){
  const ta=total(g.ha),tb=total(g.hb);
  if(!g.sa&&ta===21)g.sa=true;if(!g.sb&&tb===21)g.sb=true;
  if(g.sa&&g.sb){const ra=rank(g.ha),rb=rank(g.hb);
   if(ra===rb)return finish(g,null,'push');
   return finish(g,ra>rb?g.a:g.b,(ra===22||rb===22)?'blackjack':'higher total')}
  g.turn=!g.sa?g.a:g.b}
 async function list(me){
  const ids=await r.zrange(UK(me.uid),0,29,{rev:true});
  const vals=ids.length?await r.mget(...ids.map(GK)):[];const out=[];
  for(const g of vals){if(!g)continue;
   if(g.st==='pending'&&now()-g.t>EXPIRE){g.st='cancelled';await save(g)}
   out.push(view(g,me.uid))}
  return good({games:out})}
 async function challenge(b,me){
  const type=b.type==='bj'?'bj':b.type==='chess'?'chess':'';if(!type)return err(400,'Pick chess or blackjack');
  const to=String(b.to||'').trim().toLowerCase();if(!/^[a-z0-9_]{3,16}$/.test(to))return err(400,'Enter a username');
  if(to===me.uid)return err(400,"You can't challenge yourself");
  const u=await r.get('u:'+to);if(!u||u.banned)return err(404,'No user named '+to);
  const wager=Math.max(0,Math.min(MAXW,Math.floor(+b.wager||0)));
  if(wager>await getBal(me.uid))return err(400,"You don't have that many credits");
  const mine=(await list(me)).o.games;
  if(mine.filter(g=>g.st==='pending'&&g.a===me.uid).length>=5)return err(429,'You have too many open challenges');
  if(mine.some(g=>g.st==='pending'&&g.type===type&&((g.a===me.uid&&g.b===to)||(g.a===to&&g.b===me.uid))))return err(400,'You already have an open challenge with '+u.name);
  const cc=['white','black','random'].includes(b.color)?b.color:'random';
  const g={id:crypto.randomBytes(8).toString('hex'),type,a:me.uid,b:to,an:me.name,bn:u.name||to,wager,st:'pending',t:now(),cc};
  await save(g);return good({g:view(g,me.uid)})}
 async function accept(g,me){
  if(g.st!=='pending'||g.b!==me.uid)return err(400,'This challenge is no longer available');
  if(now()-g.t>EXPIRE){g.st='cancelled';await save(g);return err(400,'This challenge expired')}
  if(g.wager>0){
   if(await getBal(g.a)<g.wager){g.st='cancelled';await save(g);return err(400,g.an+' no longer has enough credits')}
   if(await getBal(g.b)<g.wager)return err(400,'You need '+g.wager+' credits to accept')
   await addBal(g.a,-g.wager);await addBal(g.b,-g.wager)}
  g.st='active';
  if(g.type==='chess'){g.w=g.cc==='white'?g.a:g.cc==='black'?g.b:(crypto.randomInt(2)?g.a:g.b);
   g.fen=C.START;g.hist=[new C.Chess().key()];g.mv=[];g.sn=[];g.draw=''}
  else{g.deck=newDeck();g.ha=[g.deck.pop(),g.deck.pop()];g.hb=[g.deck.pop(),g.deck.pop()];g.sa=false;g.sb=false;g.turn=g.a;bjAdvance(g)}
  await save(g);return good({g:view(g,me.uid)})}
 async function move(g,b,me){
  if(g.st!=='active')return err(400,'This game is over');
  if(turnUid(g)!==me.uid)return err(400,'Not your turn');
  if(g.type==='chess'){
   const ch=new C.Chess(g.fen),m=ch.parse(String(b.from||''),String(b.to||''),String(b.promo||''));
   if(!m)return err(400,'Illegal move');
   const san=ch.san(m),uci=ch.uci(m);ch.make(m);
   g.fen=ch.fen();g.mv.push(uci);g.sn.push(san);g.hist.push(ch.key());g.draw='';
   const st=ch.status(g.hist);
   if(st.over)await finish(g,st.res==='w'?g.w:st.res==='b'?other(g,g.w):null,st.why)}
  else{
   const mine=me.uid===g.a?'ha':'hb',stood=me.uid===g.a?'sa':'sb';
   if(b.act==='hit'){g[mine].push(g.deck.pop());
    if(total(g[mine])>21)await finish(g,other(g,me.uid),'bust');else bjAdvance(g)}
   else if(b.act==='stand'){g[stood]=true;bjAdvance(g)}
   else return err(400,'Hit or stand');
   }
  await save(g);return good({g:view(g,me.uid)})}
 async function handle(op,b,me){
  if(op==='glist')return list(me);
  if(op==='gchallenge')return challenge(b,me);
  const id=String(b.id||'');if(!/^[0-9a-f]{16}$/.test(id))return err(400,'Bad game');
  if(op==='gget'){const g=await r.get(GK(id));if(!g||(g.a!==me.uid&&g.b!==me.uid))return err(404,'Game not found');
   if(g.st==='pending'&&now()-g.t>EXPIRE){g.st='cancelled';await save(g)}
   return good({g:view(g,me.uid)})}
  if(!await r.set('glock:'+id,1,{nx:true,ex:5}))return err(409,'Busy, try again');
  try{
   const g=await r.get(GK(id));if(!g||(g.a!==me.uid&&g.b!==me.uid))return err(404,'Game not found');
   switch(op){
    case'gaccept':return await accept(g,me);
    case'gdecline':if(g.st!=='pending'||g.b!==me.uid)return err(400,'Not available');g.st='declined';await save(g);return good({g:view(g,me.uid)});
    case'gcancel':if(g.st!=='pending'||g.a!==me.uid)return err(400,'Not available');g.st='cancelled';await save(g);return good({g:view(g,me.uid)});
    case'gmove':return await move(g,b,me);
    case'gresign':if(g.st!=='active')return err(400,'Game is not active');
     await finish(g,other(g,me.uid),'resignation');await save(g);return good({g:view(g,me.uid)});
    case'gdraw':if(g.st!=='active'||g.type!=='chess')return err(400,'Not available');
     if(g.draw&&g.draw!==me.uid)await finish(g,null,'draw agreed');else g.draw=me.uid;
     await save(g);return good({g:view(g,me.uid)});
    case'gclaim':if(g.st!=='active')return err(400,'Game is not active');
     if(turnUid(g)===me.uid)return err(400,'It is your turn');
     if(now()-g.u<IDLE)return err(400,'Your opponent still has time to move');
     await finish(g,me.uid,'opponent timed out');await save(g);return good({g:view(g,me.uid)});
   }
   return err(400,'Unknown action')
  }finally{await r.del('glock:'+id)}}
 return{ops:['glist','gchallenge','gget','gaccept','gdecline','gcancel','gmove','gresign','gdraw','gclaim'],handle}
};

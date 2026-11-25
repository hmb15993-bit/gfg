/* Gives Rise of Fire the same "room" interface it gets on claude.ai, backed by this site's /api (see lib/rooms.js).
   Players are signed in with their ChatMB account (the token the site stores in localStorage). */
(function(){
 if(typeof window.claude!=="undefined")return;
 var POLL=800,HB=5000;
 function token(){try{return localStorage.getItem("cmb_tok")||""}catch(e){return ""}}
 function call(body){
  var t=token();if(!t)return Promise.reject(new Error("Sign in to ChatMB to play online."));
  return fetch("/api",{method:"POST",keepalive:body.op==="rleave",
   headers:{"content-type":"application/json",authorization:"Bearer "+t},body:JSON.stringify(body)})
  .then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||"Request failed");return j})})}

 async function join(name){
  var code=String(name||"").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,16);
  var j=await call({op:"rjoin",code:code});
  var me=j.peer,jt=j.jt,cur=j.cur,ss=null,peerList=j.peers||[],pres={},H={},cbs=[];
  var out=[],busy=false,alive=true,dirty=false,lastHb=Date.now(),loopT=null,kickT=null,sig="";

  function peers(){
   var l=peerList.filter(function(p){return p.peer!==me}).map(function(p){return{peer:p.peer,sameTab:false,presence:p.presence||{},jt:p.jt||0}});
   l.push({peer:me,sameTab:true,presence:Object.assign({},pres),jt:jt});
   l.sort(function(a,b){return a.jt-b.jt||(a.peer<b.peer?-1:1)});
   return l.map(function(p){return{peer:p.peer,sameTab:p.sameTab,presence:p.presence}})}
  function fire(e,m){(H[e]||[]).slice().forEach(function(f){try{f(m)}catch(x){console.error(x)}})}
  function notify(){var s=JSON.stringify(peers());if(s===sig)return;sig=s;cbs.slice().forEach(function(f){try{f()}catch(x){console.error(x)}})}

  async function sync(){
   if(busy||!alive)return;busy=true;
   var send=out;out=[];
   var body={op:"rsync",code:code,peer:me,cur:cur,ss:ss,g:pres.host?0:1,jt:jt};
   var hb=Date.now()-lastHb>HB,wasDirty=dirty;
   if(dirty||hb){body.pres=pres;dirty=false;lastHb=Date.now()}
   if(send.length)body.out=send;
   try{
    var r=await call(body);
    if(!alive)return;
    cur=r.cur;peerList=r.peers||[];
    (r.ev||[]).forEach(function(x){fire(x.e,{peer:x.p,data:x.d,isMe:false})});
    if(r.snap){ss=r.snap.id;(r.snap.ch||[]).forEach(function(c){fire("snap",{peer:r.snap.peer,data:c,isMe:false})})}
    notify();
   }catch(e){
    if(wasDirty)dirty=true;
    out=send.concat(out).slice(-MAXQ)}
   finally{busy=false}}
  var MAXQ=60;
  function loop(){if(!alive)return;sync().then(function(){if(alive)loopT=setTimeout(loop,POLL)})}
  function kick(){if(kickT||busy||!alive)return;kickT=setTimeout(function(){kickT=null;sync()},120)}
  function onHide(){if(alive)call({op:"rleave",code:code,peer:me}).catch(function(){})}
  addEventListener("pagehide",onHide);
  loopT=setTimeout(loop,POLL);

  return{
   peers:peers,
   presence:function(p){Object.assign(pres,p||{});dirty=true;setTimeout(notify,0);kick()},
   onPeers:function(f){cbs.push(f)},
   on:function(e,f){(H[e]=H[e]||[]).push(f)},
   emit:function(e,d){
    if(e==="snap"){var id=d&&d.id;out=out.filter(function(o){return o.e!=="snap"||(o.d&&o.d.id===id)})}
    out.push({e:e,d:d});kick()},
   leave:function(){
    if(!alive)return Promise.resolve();
    alive=false;clearTimeout(loopT);clearTimeout(kickT);removeEventListener("pagehide",onHide);
    return call({op:"rleave",code:code,peer:me}).catch(function(){})}
  }}

 /* "downloads": lets the game's Save button hand the browser a .json file */
 var dls={save:function(o){return new Promise(function(res,rej){
  try{var b=new Blob([String(o.data)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");
   a.href=u;a.download=o.filename||"save.json";document.body.appendChild(a);a.click();a.remove();
   setTimeout(function(){URL.revokeObjectURL(u)},4000);res()}catch(e){rej(e)}})}};
 window.claude={use:function(n){
  if(n==="downloads")return Promise.resolve(dls);
  if(n!=="room"||!token())return Promise.resolve(null);
  return Promise.resolve({join:join})}};
})();

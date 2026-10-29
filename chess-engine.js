/* Self-contained chess engine: rules, SAN, draw detection and a small alpha-beta bot.
   Used by the server (move validation) and the browser (board + bot). No dependencies. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ChessEngine=factory()})(typeof self!=='undefined'?self:this,function(){
'use strict';
const FILES='abcdefgh',PCH='?PNBRQK',START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KN=[-33,-31,-18,-14,14,18,31,33],KG=[-17,-16,-15,-1,1,15,16,17],BD=[-17,-15,15,17],RD=[-16,-1,1,16];
const VAL=[0,100,320,330,500,900,0],INF=1e6,MATE=30000;
const PRN={n:2,b:3,r:4,q:5};
const sqName=s=>FILES[s&7]+((s>>4)+1),sqIdx=n=>(n.charCodeAt(0)-97)+(n.charCodeAt(1)-49)*16;
const mk=(f,t,pr,fl)=>f|(t<<7)|(pr<<14)|(fl<<17);
/* piece-square tables, white's view, index 0 = a8 */
const PST=[null,
[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20]];
const KMG=[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20];
const KEG=[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50];
const LV={1:{d:2,rnd:120,rr:.12,ms:700},2:{d:3,rnd:20,rr:0,ms:1500},3:{d:7,rnd:0,rr:0,ms:2500}};

function Chess(fen){
 const b=new Array(128).fill(0),kpos=[0,0],stack=[];
 let turn=0,castle=0,ep=-1,half=0,full=1,nodes=0,deadline=0,aborted=false;

 function load(f){b.fill(0);const p=String(f||START).trim().split(/\s+/);let r=7,c=0;
  for(const ch of p[0]){if(ch==='/'){r--;c=0}else if(ch>='1'&&ch<='8')c+=+ch;
   else{const lo=ch.toLowerCase(),t='pnbrqk'.indexOf(lo)+1,col=ch===lo?1:0,s=r*16+c;b[s]=t|(col<<3);if(t===6)kpos[col]=s;c++}}
  turn=p[1]==='b'?1:0;castle=0;const cs=p[2]||'-';
  if(cs.includes('K'))castle|=1;if(cs.includes('Q'))castle|=2;if(cs.includes('k'))castle|=4;if(cs.includes('q'))castle|=8;
  ep=p[3]&&p[3]!=='-'?sqIdx(p[3]):-1;half=+p[4]||0;full=+p[5]||1;stack.length=0}
 function fenStr(){let s='';
  for(let r=7;r>=0;r--){let e=0;for(let c=0;c<8;c++){const p=b[r*16+c];if(!p)e++;else{if(e){s+=e;e=0}const ch='pnbrqk'[(p&7)-1];s+=(p>>3)?ch:ch.toUpperCase()}}if(e)s+=e;if(r)s+='/'}
  const cs=(castle&1?'K':'')+(castle&2?'Q':'')+(castle&4?'k':'')+(castle&8?'q':'');
  return s+' '+(turn?'b':'w')+' '+(cs||'-')+' '+(ep>=0?sqName(ep):'-')+' '+half+' '+full}
 const key=()=>fenStr().split(' ').slice(0,4).join(' ');

 function attacked(sq,by){
  const pp=1|by<<3,pd=by?[15,17]:[-15,-17];
  for(const d of pd){const s=sq+d;if(!(s&0x88)&&b[s]===pp)return true}
  const np=2|by<<3,kp=6|by<<3,bp=3|by<<3,rp=4|by<<3,qp=5|by<<3;
  for(const d of KN){const s=sq+d;if(!(s&0x88)&&b[s]===np)return true}
  for(const d of KG){const s=sq+d;if(!(s&0x88)&&b[s]===kp)return true}
  for(const d of BD){let s=sq+d;while(!(s&0x88)){const p=b[s];if(p){if(p===bp||p===qp)return true;break}s+=d}}
  for(const d of RD){let s=sq+d;while(!(s&0x88)){const p=b[s];if(p){if(p===rp||p===qp)return true;break}s+=d}}
  return false}

 function gen(capOnly){const out=[],us=turn,them=us^1;
  for(let s=0;s<128;s++){
   if(s&0x88){s+=7;continue}
   const p=b[s];if(!p||(p>>3)!==us)continue;const t=p&7;
   if(t===1){
    const dir=us?-16:16,r=s>>4,promoR=us?1:6,startR=us?6:1,to=s+dir;
    if(!b[to]){
     if(r===promoR){for(let pr=5;pr>=2;pr--)out.push(mk(s,to,pr,0))}
     else if(!capOnly){out.push(mk(s,to,0,0));if(r===startR&&!b[to+dir])out.push(mk(s,to+dir,0,8))}}
    for(const d of [dir-1,dir+1]){const c=s+d;if(c&0x88)continue;const q=b[c];
     if(q&&(q>>3)===them){if(r===promoR){for(let pr=5;pr>=2;pr--)out.push(mk(s,c,pr,1))}else out.push(mk(s,c,0,1))}
     else if(!q&&c===ep)out.push(mk(s,c,0,3))}
   }else if(t===2||t===6){
    for(const d of (t===2?KN:KG)){const c=s+d;if(c&0x88)continue;const q=b[c];
     if(!q){if(!capOnly)out.push(mk(s,c,0,0))}else if((q>>3)===them)out.push(mk(s,c,0,1))}
    if(t===6&&!capOnly){
     if(us===0&&s===4){
      if((castle&1)&&!b[5]&&!b[6]&&b[7]===4&&!attacked(4,1)&&!attacked(5,1)&&!attacked(6,1))out.push(mk(4,6,0,4));
      if((castle&2)&&!b[3]&&!b[2]&&!b[1]&&b[0]===4&&!attacked(4,1)&&!attacked(3,1)&&!attacked(2,1))out.push(mk(4,2,0,4))}
     if(us===1&&s===116){
      if((castle&4)&&!b[117]&&!b[118]&&b[119]===12&&!attacked(116,0)&&!attacked(117,0)&&!attacked(118,0))out.push(mk(116,118,0,4));
      if((castle&8)&&!b[115]&&!b[114]&&!b[113]&&b[112]===12&&!attacked(116,0)&&!attacked(115,0)&&!attacked(114,0))out.push(mk(116,114,0,4))}}
   }else{
    const dirs=t===3?BD:t===4?RD:BD.concat(RD);
    for(const d of dirs){let c=s+d;while(!(c&0x88)){const q=b[c];
     if(!q){if(!capOnly)out.push(mk(s,c,0,0))}else{if((q>>3)===them)out.push(mk(s,c,0,1));break}c+=d}}}
  }
  return out}

 function make(m){
  const f=m&127,t=(m>>7)&127,pr=(m>>14)&7,fl=m>>17,p=b[f];let cap=b[t];
  if(fl&2){const cs=t+(turn?16:-16);cap=b[cs];b[cs]=0}
  stack.push(m,cap,castle,ep,half);
  b[t]=pr?(pr|turn<<3):p;b[f]=0;
  if((p&7)===6){kpos[turn]=t;castle&=turn?~12:~3;
   if(fl&4){if(t>f){b[t-1]=b[t+1];b[t+1]=0}else{b[t+1]=b[t-2];b[t-2]=0}}}
  if(f===0||t===0)castle&=~2;if(f===7||t===7)castle&=~1;if(f===112||t===112)castle&=~8;if(f===119||t===119)castle&=~4;
  ep=(fl&8)?((f+t)>>1):-1;
  half=((p&7)===1||cap)?0:half+1;if(turn)full++;turn^=1}
 function undo(){
  half=stack.pop();ep=stack.pop();castle=stack.pop();const cap=stack.pop(),m=stack.pop();
  turn^=1;if(turn)full--;
  const f=m&127,t=(m>>7)&127,pr=(m>>14)&7,fl=m>>17;let p=b[t];if(pr)p=1|turn<<3;
  b[f]=p;b[t]=0;
  if(fl&2)b[t+(turn?16:-16)]=cap;else b[t]=cap;
  if((p&7)===6){kpos[turn]=f;if(fl&4){if(t>f){b[t+1]=b[t-1];b[t-1]=0}else{b[t-2]=b[t+1];b[t+1]=0}}}}

 const inCheck=()=>attacked(kpos[turn],turn^1);
 function moves(){const out=[],us=turn;for(const m of gen(false)){make(m);if(!attacked(kpos[us],us^1))out.push(m);undo()}return out}
 function insufficient(){let minors=0;
  for(let s=0;s<128;s++){if(s&0x88){s+=7;continue}const t=b[s]&7;if(t===1||t===4||t===5)return false;if(t===2||t===3)minors++}
  return minors<=1}
 function status(hist){const ms=moves();
  if(!ms.length)return inCheck()?{over:1,res:turn?'w':'b',why:'checkmate'}:{over:1,res:'d',why:'stalemate'};
  if(half>=100)return{over:1,res:'d',why:'50-move rule'};
  if(insufficient())return{over:1,res:'d',why:'insufficient material'};
  if(hist){const k=key();let n=0;for(const x of hist)if(x===k)n++;if(n>=3)return{over:1,res:'d',why:'threefold repetition'}}
  return{over:0}}
 const uci=m=>sqName(m&127)+sqName((m>>7)&127)+(((m>>14)&7)?'nbrq'[((m>>14)&7)-2]:'');
 function parse(fr,to,pr){
  if(!/^[a-h][1-8]$/.test(fr||'')||!/^[a-h][1-8]$/.test(to||''))return 0;
  const f=sqIdx(fr),t=sqIdx(to),want=PRN[String(pr||'q').toLowerCase()]||5;
  for(const m of moves())if((m&127)===f&&((m>>7)&127)===t){const mp=(m>>14)&7;if(!mp||mp===want)return m}
  return 0}
 function san(m){
  const f=m&127,t=(m>>7)&127,pr=(m>>14)&7,fl=m>>17,ty=b[f]&7;let s;
  if(fl&4)s=t>f?'O-O':'O-O-O';
  else if(ty===1){s=(fl&1)?FILES[f&7]+'x'+sqName(t):sqName(t);if(pr)s+='='+PCH[pr]}
  else{s=PCH[ty];let amb=false,sf=false,sr=false;
   for(const o of moves()){if(o===m)continue;const of=o&127;if(((o>>7)&127)===t&&of!==f&&(b[of]&7)===ty){amb=true;if((of&7)===(f&7))sf=true;if((of>>4)===(f>>4))sr=true}}
   if(amb){if(!sf)s+=FILES[f&7];else if(!sr)s+=(f>>4)+1;else s+=sqName(f)}
   if(fl&1)s+='x';s+=sqName(t)}
  make(m);const n=moves().length,chk=inCheck();undo();
  if(chk)s+=n?'+':'#';return s}
 function board64(){const o=[];for(let r=7;r>=0;r--)for(let c=0;c<8;c++){const p=b[r*16+c];o.push(p?((p>>3)?'pnbrqk'[(p&7)-1]:'PNBRQK'[(p&7)-1]):'')}return o}
 function legalUci(){return moves().map(m=>({from:sqName(m&127),to:sqName((m>>7)&127),promo:((m>>14)&7)?'nbrq'[((m>>14)&7)-2]:''}))}
 function perft(d){if(!d)return 1;let n=0;const us=turn;for(const m of gen(false)){make(m);if(!attacked(kpos[us],us^1))n+=d>1?perft(d-1):1;undo()}return n}

 /* ---------- bot ---------- */
 function evaluate(){let sc=0,phase=0;const ks=[-1,-1];
  for(let s=0;s<128;s++){if(s&0x88){s+=7;continue}const p=b[s];if(!p)continue;
   const t=p&7,c=p>>3,r=s>>4,f=s&7,idx=c?r*8+f:(7-r)*8+f;
   if(t===6){ks[c]=idx;continue}
   if(t>=2&&t<=5)phase+=t===5?4:t===4?2:1;
   const v=VAL[t]+PST[t][idx];sc+=c?-v:v}
  const T=phase<=8?KEG:KMG;sc+=T[ks[0]]-T[ks[1]];
  return turn?-sc:sc}
 function order(ms){const sc=ms.map(m=>{const fl=m>>17,pr=(m>>14)&7;let s=0;
   if(fl&1){const v=(fl&2)?1:(b[(m>>7)&127]&7);s=10000+10*VAL[v]-VAL[b[m&127]&7]}
   if(pr)s+=9000+VAL[pr];return[s,m]});
  sc.sort((x,y)=>y[0]-x[0]);return sc.map(x=>x[1])}
 function tick(){if((++nodes&1023)===0&&Date.now()>deadline)aborted=true;return aborted}
 function quiesce(alpha,beta,ply){
  if(tick())return 0;
  const st=evaluate();if(st>=beta)return st;if(st>alpha)alpha=st;if(ply>16)return st;
  const us=turn;
  for(const m of order(gen(true))){make(m);
   if(attacked(kpos[us],us^1)){undo();continue}
   const sc=-quiesce(-beta,-alpha,ply+1);undo();if(aborted)return 0;
   if(sc>=beta)return sc;if(sc>alpha)alpha=sc}
  return alpha}
 function search(depth,alpha,beta,ply){
  if(half>=100)return 0;
  const us=turn,chk=attacked(kpos[us],us^1);if(chk&&ply<20)depth++;
  if(depth<=0)return quiesce(alpha,beta,ply);
  if(tick())return 0;
  let legal=0,best=-INF;
  for(const m of order(gen(false))){make(m);
   if(attacked(kpos[us],us^1)){undo();continue}
   legal++;const sc=-search(depth-1,-beta,-alpha,ply+1);undo();if(aborted)return 0;
   if(sc>best)best=sc;if(sc>alpha)alpha=sc;if(alpha>=beta)break}
  if(!legal)return chk?-MATE+ply:0;
  return best}
 /* returns uci string of the chosen move, or null if no legal move. level 1 easy, 2 medium, 3 hard */
 function think(level){
  const cfg=LV[level]||LV[2],rootMoves=moves();if(!rootMoves.length)return null;
  let scored=order(rootMoves).map(m=>({m,s:0}));
  deadline=Date.now()+cfg.ms;aborted=false;nodes=0;
  const full=cfg.rnd>0;
  for(let d=1;d<=cfg.d;d++){
   const cur=[];let alpha=-INF;
   for(const x of scored){make(x.m);const sc=-search(d-1,-INF,full?INF:-alpha,1);undo();if(aborted)break;cur.push({m:x.m,s:sc});if(!full&&sc>alpha)alpha=sc}
   if(aborted)break;
   cur.sort((a,c)=>c.s-a.s);scored=cur;
   if(cur[0].s>MATE-50)break}
  scored.sort((a,c)=>c.s-a.s);
  if(cfg.rr&&Math.random()<cfg.rr)return uci(rootMoves[Math.floor(Math.random()*rootMoves.length)]);
  if(!full)return uci(scored[0].m);
  const top=scored[0].s,pool=scored.filter(x=>x.s>=top-cfg.rnd);
  return uci(pool[Math.floor(Math.random()*pool.length)].m)}

 load(fen);
 return{fen:fenStr,key,load,moves,make,undo,inCheck,status,parse,uci,san,board64,legalUci,perft,think,
  turn:()=>turn?'b':'w',kingSq:c=>sqName(kpos[c==='b'?1:0]),fullmove:()=>full}
}
return{Chess,START}
});

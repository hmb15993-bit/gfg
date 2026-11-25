/* GFG Proxy: fetches a web page on the server and rewrites its links so the page keeps working inside the Proxy tab.
   - Only signed-in members can use it: the Proxy tab asks the API (op "pxtoken") for a 2 hour key and puts it in every URL (?k=).
   - The tab shows the result in a sandboxed frame WITHOUT same-origin access, and every response carries a CSP "sandbox" header,
     so a proxied page can never read the site's login token or storage.
   - It refuses private/internal addresses (checked again at connect time, so DNS tricks do not work) and known ad hosts.
   - This is a plain server-side rewriting proxy (no service worker, no websocket). Simple and medium sites work; heavy web apps
     (YouTube, Discord, TikTok, X) usually do not. See README. */
const crypto=require('crypto'),http=require('http'),https=require('https'),dns=require('dns'),net=require('net'),zlib=require('zlib');
const SEC=process.env.SESSION_SECRET||'';
const sign=s=>crypto.createHmac('sha256',SEC).update(s).digest('base64url');
function okTok(k){const p=String(k||'').split('.');if(p.length!==3)return false;const[u,e,s]=p;
 if(!/^[a-z0-9_]{1,16}$/.test(u)||!/^\d{10,15}$/.test(e)||+e<Date.now())return false;
 const a=Buffer.from(sign('px:'+u+'.'+e)),b=Buffer.from(s);return a.length===b.length&&crypto.timingSafeEqual(a,b)}

/* ---- block internal addresses ---- */
const BL=new net.BlockList();
[['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]].forEach(([a,p])=>BL.addSubnet(a,p,'ipv4'));
[['::',128],['::1',128],['64:ff9b::',96],['100::',64],['2001:db8::',32],['fc00::',7],['fe80::',10],['ff00::',8]].forEach(([a,p])=>BL.addSubnet(a,p,'ipv6'));
const bad=ip=>{const f=net.isIP(ip);return !f||BL.check(ip,f===4?'ipv4':'ipv6')};
function safeLookup(host,opts,cb){
 if(typeof opts==='function'){cb=opts;opts={}}
 dns.lookup(host,{...opts,all:true},(e,addrs)=>{
  if(e)return cb(e);
  if(!addrs.length||addrs.some(a=>bad(a.address)))return cb(Object.assign(new Error('Blocked address'),{code:'EBLOCKED'}));
  if(opts&&opts.all)return cb(null,addrs);cb(null,addrs[0].address,addrs[0].family)})}
const AD=/(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com|2mdn\.net|adnxs\.com|adsrvr\.org|amazon-adsystem\.com|moatads\.com|criteo\.com|pubmatic\.com|rubiconproject\.com|openx\.net|adform\.net|taboola\.com|outbrain\.com|popads\.net|popcash\.net|propellerads\.com|exoclick\.com|juicyads\.com|trafficjunky\.net|clickadu\.com|adsterra\.com|hilltopads\.net|onclkds\.com|adsco\.re|a-ads\.com|ad-maven\.com|admaven\.com|mc\.yandex\.ru)$/i;

/* ---- url rewriting ---- */
const SKIP=/^(#|data:|blob:|javascript:|mailto:|tel:|about:|sms:)/i;
const pxFn=(base,P)=>u=>{u=String(u==null?'':u).trim();if(!u||SKIP.test(u))return u;let a;try{a=new URL(u,base)}catch(e){return u}
 if(!/^https?:$/.test(a.protocol))return u;const h=a.hash;a.hash='';return P+encodeURIComponent(a.href)+h};
const dec=s=>String(s).replace(/&(amp|quot|lt|gt|#39|#x27);/gi,(m,x)=>({amp:'&',quot:'"',lt:'<',gt:'>','#39':"'",'#x27':"'"})[x.toLowerCase()]);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
function rwCss(css,px){
 return css.replace(/url\(\s*(['"]?)([^'")]*?)\1\s*\)/gi,(m,q,u)=>'url('+q+px(u)+q+')')
  .replace(/@import\s+(['"])([^'"]*?)\1/gi,(m,q,u)=>'@import '+q+px(u)+q)}
const SRC_ATTRS=new Set(['href','src','action','poster','data','formaction','background','data-src','data-lazy-src','data-original','data-href']);
function fixTag(tag,attrStr,px,ctx){
 tag=tag.toLowerCase();
 const at=[],re=/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;let m;
 while((m=re.exec(attrStr))){at.push({n:m[1].toLowerCase(),v:m[2]!==undefined?m[2]:m[3]!==undefined?m[3]:m[4],raw:m[1]})}
 const get=n=>{const a=at.find(x=>x.n===n);return a?dec(a.v==null?'':a.v):null};
 if(tag==='base')return{drop:true};
 if(tag==='meta'){const he=(get('http-equiv')||'').toLowerCase();
  if(he==='content-security-policy'||he==='x-frame-options'||get('charset')!==null)return{drop:true};
  if(he==='refresh'){const c=get('content')||'';const x=/^\s*([\d.]*)\s*[;,]\s*(?:url\s*=\s*)?['"]?(.*?)['"]?\s*$/i.exec(c);
   if(x){const a=at.find(y=>y.n==='content');a.v=x[1]+'; url='+px(x[2])}}}
 let form=null;
 if(tag==='form'){const meth=(get('method')||'get').toLowerCase();
  if(meth!=='post'){let abs;try{abs=new URL(get('action')||ctx.base,ctx.base).href.split('#')[0]}catch(e){abs=ctx.base}
   if(/^https?:/i.test(abs))form={abs}}}
 const out=[];
 for(const a of at){
  if(['integrity','crossorigin','nonce','ping','referrerpolicy'].includes(a.n))continue;
  if(a.n==='target'&&(tag==='a'||tag==='area'||tag==='form'))continue;
  if(a.v===undefined){out.push(a.raw);continue}
  let v=dec(a.v);
  if(form&&a.n==='action'){out.push('action="'+esc(ctx.origin+'/api/proxy')+'"');continue}
  if(SRC_ATTRS.has(a.n)&&!(tag==='meta'))v=px(v);
  else if((a.n==='srcset'||a.n==='imagesrcset')){v=v.split(',').map(s=>{s=s.trim();const i=s.search(/\s/);return i<0?px(s):px(s.slice(0,i))+s.slice(i)}).join(', ')}
  else if(a.n==='style')v=rwCss(v,px);
  out.push(a.n+'="'+esc(v)+'"')}
 if(form&&!at.some(a=>a.n==='action'))out.push('action="'+esc(ctx.origin+'/api/proxy')+'"');
 return{attrs:out.join(' '),after:form?'<input type="hidden" name="k" value="'+esc(ctx.k)+'"><input type="hidden" name="u" value="'+esc(form.abs)+'">':''}}
const TAGRE=/(<script\b(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/script\s*>)|(<style\b(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/style\s*>)|<!--[\s\S]*?-->|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
function shim(B,P,K){
 const j=x=>JSON.stringify(x).replace(/</g,'\\u003c');
 return '<script>(function(){var B='+j(B)+',P='+j(P)+';'+
 'function px(u){try{u=String(u);if(!u||/^(#|data:|blob:|javascript:|mailto:|tel:|about:)/i.test(u)||u.indexOf(P)===0)return u;var a=new URL(u,B);if(!/^https?:$/.test(a.protocol))return u;var h=a.hash;a.hash="";return P+encodeURIComponent(a.href)+h}catch(e){return u}}'+
 'var of=window.fetch;if(of)window.fetch=function(i,o){try{if(typeof i==="string"||(window.URL&&i instanceof URL))i=px(i);else if(i&&i.url)i=new Request(px(i.url),i)}catch(e){}return of.call(this,i,o)};'+
 'var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);a[1]=px(u);return xo.apply(this,a)};'+
 'window.open=function(u){if(u){try{location.assign(px(u))}catch(e){}}return null};'+
 'function hook(C,p){try{var d=Object.getOwnPropertyDescriptor(C.prototype,p);if(!d||!d.set)return;Object.defineProperty(C.prototype,p,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){d.set.call(this,px(v))}})}catch(e){}}'+
 '[["HTMLAnchorElement","href"],["HTMLAreaElement","href"],["HTMLImageElement","src"],["HTMLScriptElement","src"],["HTMLLinkElement","href"],["HTMLIFrameElement","src"],["HTMLSourceElement","src"],["HTMLMediaElement","src"],["HTMLEmbedElement","src"],["HTMLTrackElement","src"],["HTMLInputElement","src"]].forEach(function(x){if(window[x[0]])hook(window[x[0]],x[1])});'+
 'var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){var l=String(n).toLowerCase();if(l==="src"||l==="href"||l==="poster"||l==="data-src")v=px(v);return sa.call(this,n,v)};'+
 'function mem(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}'+
 '["localStorage","sessionStorage"].forEach(function(n){try{void window[n]}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});'+
 'try{void document.cookie}catch(e){var ck="";try{Object.defineProperty(document,"cookie",{get:function(){return ck},set:function(v){ck+=(ck?"; ":"")+String(v).split(";")[0]},configurable:true})}catch(_){}}'+
 'document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");a.removeAttribute("target");if(h&&h.indexOf(P)!==0&&!/^(#|javascript:)/i.test(h))a.setAttribute("href",h)},true);'+
 'function note(){try{parent.postMessage({gfgpx:1,url:B,title:document.title||""},"*")}catch(e){}}'+
 'addEventListener("DOMContentLoaded",note);addEventListener("load",note);'+
 'addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data||{};if(d.gfgpx==="back")history.back();else if(d.gfgpx==="fwd")history.forward()});'+
 '})();</script>'}
function rewriteHtml(html,base,P,K,origin){
 let b=base;const bm=/<base\b(?:"[^"]*"|'[^']*'|[^'">])*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(html);
 if(bm){try{b=new URL(dec(bm[1]!==undefined?bm[1]:bm[2]!==undefined?bm[2]:bm[3]),base).href}catch(e){}}
 const px=pxFn(b,P),ctx={base:b,origin,k:K};
 html=html.replace(TAGRE,(m,so,sb,sc,sto,stb,stc,tag,attrs)=>{
  if(so){const r=fixTag('script',so.slice(7,-1),px,ctx);return '<script'+(r.attrs?' '+r.attrs:'')+'>'+sb+sc}
  if(sto)return '<style>'+rwCss(stb,px)+stc;
  if(!tag)return m;
  const r=fixTag(tag,attrs,px,ctx);
  if(r.drop)return '';
  return '<'+tag+(r.attrs?' '+r.attrs:'')+'>'+r.after});
 const s=shim(b,P,K);
 if(/<head\b[^>]*>/i.test(html))return html.replace(/<head\b[^>]*>/i,x=>x+s);
 if(/<html\b[^>]*>/i.test(html))return html.replace(/<html\b[^>]*>/i,x=>x+s);
 return s+html}

/* ---- upstream request ---- */
function up(u,method,headers,body){return new Promise((ok,no)=>{
 const rq=(u.protocol==='https:'?https:http).request(u,{method,headers,lookup:safeLookup,timeout:20000},ok);
 rq.on('timeout',()=>rq.destroy(new Error('The site took too long to answer')));rq.on('error',no);
 if(body&&body.length)rq.write(body);rq.end()})}
const readBody=(req,max)=>new Promise((ok,no)=>{const c=[];let n=0;
 req.on('data',d=>{n+=d.length;if(n>max){no(new Error('Upload too large'));req.destroy()}else c.push(d)});
 req.on('end',()=>ok(Buffer.concat(c)));req.on('error',no)});
const readAll=(s,max)=>new Promise((ok,no)=>{const c=[];let n=0;
 s.on('data',d=>{n+=d.length;if(n>max){no(new Error('That page is too large to proxy'));s.destroy()}else c.push(d)});
 s.on('end',()=>ok(Buffer.concat(c)));s.on('error',no)});
function page(res,code,title,msg){
 res.statusCode=code;res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');
 res.setHeader('content-security-policy','sandbox');
 res.end('<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1f14;color:#e6f7ec;font:15px/1.5 Roboto,system-ui,sans-serif;text-align:center"><div style="max-width:420px;padding:24px"><h1 style="font-size:22px;font-weight:500;margin:0 0 8px">'+
  title.replace(/</g,'&lt;')+'</h1><p style="color:#8fbfa3;margin:0">'+msg.replace(/</g,'&lt;')+'</p></div>')}

module.exports=async(req,res)=>{
 res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('access-control-allow-methods','GET,POST,HEAD,OPTIONS');
 res.setHeader('cross-origin-resource-policy','cross-origin');
 if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
 try{
  if(!SEC)return page(res,500,'Proxy not set up','SESSION_SECRET is missing on the server.');
  const q=new URL(req.url,'http://x').searchParams;
  const k=q.get('k')||'',u=q.get('u')||'';
  if(!okTok(k))return page(res,401,'Proxy session expired','Go back to the Proxy tab and open the page again.');
  let target;try{target=new URL(u)}catch(e){return page(res,400,'Not a web address','That does not look like a valid link.')}
  if(!/^https?:$/.test(target.protocol))return page(res,400,'Not a web address','Only http and https links work.');
  const hostH=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim().toLowerCase();
  const proto=String(req.headers['x-forwarded-proto']||(req.socket&&req.socket.encrypted?'https':'http')).split(',')[0].trim();
  const origin=proto+'://'+hostH,P=origin+'/api/proxy?k='+k+'&u=';
  const isGet=req.method==='GET'||req.method==='HEAD';
  if(isGet)for(const[a,b]of new URL(req.url,'http://x').searchParams){if(a!=='k'&&a!=='u')target.searchParams.append(a,b)}
  let method=req.method==='HEAD'?'HEAD':req.method,body=isGet?null:await readBody(req,5e6),ctIn=req.headers['content-type'],cur=target,r;
  for(let hop=0;hop<7;hop++){
   const hn=cur.hostname.replace(/^\[|\]$/g,'');
   if(cur.host.toLowerCase()===hostH)return page(res,400,'Nope','The proxy cannot open itself.');
   if(AD.test(hn)){res.statusCode=204;return res.end()}
   if(net.isIP(hn)&&bad(hn))return page(res,403,'Blocked','That address is not allowed.');
   const h={'user-agent':req.headers['user-agent']||'Mozilla/5.0','accept':req.headers.accept||'*/*','accept-language':req.headers['accept-language']||'en-US,en;q=0.9','accept-encoding':'gzip, deflate, br','referer':cur.origin+'/'};
   if(req.headers.range)h.range=req.headers.range;
   if(body&&body.length){h['content-length']=body.length;if(ctIn)h['content-type']=ctIn}
   r=await up(cur,method,h,body);
   if([301,302,303,307,308].includes(r.statusCode)&&r.headers.location){
    r.resume();let nx;try{nx=new URL(r.headers.location,cur)}catch(e){return page(res,502,'Bad redirect','The site sent a broken redirect.')}
    if(!/^https?:$/.test(nx.protocol))return page(res,502,'Bad redirect','The site redirected somewhere that is not a web page.');
    if(r.statusCode===303||((r.statusCode===301||r.statusCode===302)&&method==='POST')){method='GET';body=null}
    cur=nx;r=null;continue}
   break}
  if(!r)return page(res,508,'Too many redirects','That site keeps redirecting.');
  const ct=String(r.headers['content-type']||''),type=ct.split(';')[0].trim().toLowerCase(),enc=String(r.headers['content-encoding']||'').toLowerCase();
  let s=r;
  if(enc==='gzip'||enc==='x-gzip')s=r.pipe(zlib.createGunzip());else if(enc==='br')s=r.pipe(zlib.createBrotliDecompress());else if(enc==='deflate')s=r.pipe(zlib.createInflate());
  const isHtml=type==='text/html'||type==='application/xhtml+xml',isCss=type==='text/css';
  res.setHeader('content-security-policy','sandbox allow-scripts allow-forms allow-modals allow-pointer-lock allow-presentation allow-downloads');
  res.setHeader('referrer-policy','no-referrer');
  if(isHtml||isCss){
   const buf=await readAll(s,8e6);
   let cs='utf-8';const cm=/charset\s*=\s*["']?([\w-]+)/i.exec(ct)||/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(buf.subarray(0,2048).toString('latin1'));
   if(cm)cs=cm[1];let txt;try{txt=new TextDecoder(cs).decode(buf)}catch(e){txt=buf.toString('utf8')}
   const out=isHtml?rewriteHtml(txt,cur.href,P,k,origin):rwCss(txt,pxFn(cur.href,P));
   res.statusCode=r.statusCode;res.setHeader('content-type',(isHtml?'text/html':'text/css')+'; charset=utf-8');
   res.setHeader('cache-control',isHtml?'no-store':'private,max-age=600');
   return res.end(req.method==='HEAD'?undefined:out)}
  const hd={};for(const n of['content-type','content-disposition','content-range','accept-ranges','etag','last-modified'])if(r.headers[n])hd[n]=r.headers[n];
  if(!enc&&r.headers['content-length'])hd['content-length']=r.headers['content-length'];
  hd['cache-control']='private,max-age=600';if(hd['content-type'])hd['x-content-type-options']='nosniff';
  for(const n in hd)res.setHeader(n,hd[n]);res.statusCode=r.statusCode;
  if(req.method==='HEAD'){r.resume();return res.end()}
  s.on('error',()=>res.destroy());res.on('close',()=>r.destroy());s.pipe(res);
 }catch(e){
  const m=String(e&&e.message||e);
  if(res.headersSent){try{res.destroy()}catch(_){}return}
  if(e&&e.code==='EBLOCKED')return page(res,403,'Blocked','That address is not allowed.');
  if(e&&(e.code==='ENOTFOUND'||e.code==='EAI_AGAIN'))return page(res,502,'Site not found','Could not find that website. Check the address.');
  page(res,502,'Could not load that page',m.slice(0,160))}};
module.exports.config={api:{bodyParser:false}};
module.exports._t={rewriteHtml,rwCss,pxFn,okTok,bad,sign};

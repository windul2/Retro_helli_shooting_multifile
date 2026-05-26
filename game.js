(()=>{
'use strict';

const GAME_ASSETS = window.GAME_ASSETS || {};
const IMG = {};
function loadImageAsset(key, src){
  if(!src) return;
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => { im.ready = true; };
  im.onerror = () => { console.warn('ASSET_LOAD_FAILED', key, src); };
  im.src = src;
  IMG[key] = im;
}
Object.entries(GAME_ASSETS.images || {}).forEach(([key, src]) => loadImageAsset(key, src));
function drawAsset(key, x, y, w, h, flip=1, rot=0){
  const im = IMG[key];
  if(!im || !im.ready) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(flip, 1);
  ctx.drawImage(im, -w/2, -h/2, w, h);
  ctx.restore();
  return true;
}

window.addEventListener('error',e=>console.error('GAME_ERROR',e.message,e.filename,e.lineno));

const cvs=document.getElementById('game'),ctx=cvs.getContext('2d');ctx.imageSmoothingEnabled=false;
const $=id=>document.getElementById(id);
let W=540,H=960,landscape=false,last=0,state='main';
const screens=['main','pause','over','exit'].map($);
function show(id){screens.forEach(s=>s.classList.remove('on')); if($(id))$(id).classList.add('on'); const play=id==='game'; $('topBtns').style.display=play?'flex':'none'; $('hudNote').style.display=play?'block':'none';}
function fitWrap(){const wrap=$('wrap'),vv=window.visualViewport,aw=Math.max(320,vv?vv.width:innerWidth),ah=Math.max(240,vv?vv.height:innerHeight),ox=vv?vv.offsetLeft:0,oy=vv?vv.offsetTop:0,ratio=landscape?16/9:9/16,gap=landscape?12:6;let mw=aw-gap*2,mh=ah-gap*2;if(landscape)mh*=.92;let cw=mw,ch=cw/ratio;if(ch>mh){ch=mh;cw=ch*ratio}wrap.style.width=cw+'px';wrap.style.height=ch+'px';wrap.style.left=(ox+(aw-cw)/2)+'px';wrap.style.top=(oy+(ah-ch)/2)+'px';wrap.style.transform='none';}
function resize(){landscape=innerWidth>innerHeight;W=landscape?960:540;H=landscape?540:960;cvs.width=W;cvs.height=H;ctx.imageSmoothingEnabled=false;fitWrap();}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,160));if(window.visualViewport){window.visualViewport.addEventListener('resize',resize);window.visualViewport.addEventListener('scroll',fitWrap)}resize();

const PI=Math.PI;
let musicOn=true,audioCtx=null,musicTimer=null,musicStep=0,booting=true;
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}
function beep(freq,dur=.06,type='square',gain=.035,when){if(!audioCtx||!musicOn&&type==='triangle')return;const t=when||audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.02);}
function startMusic(){musicOn=true;ensureAudio();updateMusicButtons();if(musicTimer)clearInterval(musicTimer);musicStep=0;musicTimer=setInterval(()=>{if(state==='play'&&musicOn){const notes=[98,130.8,146.8,164.8,196,164.8,146.8,130.8];const n=notes[musicStep%notes.length];beep(n,.08,'square',.014);if(musicStep%4===0)beep(n/2,.11,'triangle',.012);musicStep++;}},185);}
function stopMusic(){musicOn=false;if(musicTimer){clearInterval(musicTimer);musicTimer=null}updateMusicButtons()}
function toggleMusic(){musicOn?stopMusic():startMusic()}
function updateMusicButtons(){const txt=musicOn?'음악 ON':'음악 OFF';$('musicBtn').textContent=txt;$('mainMusicBtn').textContent=txt;}

let opt={time:75,diff:1,weapon:'cannon'};
function bindOpts(row,field,attr){[...$(row).querySelectorAll('.opt')].forEach(b=>b.onclick=()=>{[...$(row).querySelectorAll('.opt')].forEach(x=>x.classList.remove('on'));b.classList.add('on');let v=b.dataset[attr];opt[field]=field==='time'||field==='diff'?Number(v):v;});}
bindOpts('timeRow','time','time');bindOpts('diffRow','diff','diff');bindOpts('weaponRow','weapon','weapon');

let p=null,helis=[],bombs=[],shots=[],exps=[],particles=[],pickups=[],clouds=[],score=0,hi,kills=0,wave=1,missionTime=0,elapsed=0,shake=0,flash=0,fireCd=0,spawnCd=0,bossSpawned=false,combo=0,comboTimer=0;
let touch={left:false,right:false,fire:false,look:false,lastX:0,leftId:null,rightId:null,fireId:null,lookId:null},keys={};
try{hi=Number(localStorage.getItem('retroHeliHi')||0)}catch(e){hi=0}
function rnd(a,b){return a+Math.random()*(b-a)}function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function reset(){
  p={angle:-PI/2,hp:100,shield:70,ammo:opt.weapon==='rapid'?180:opt.weapon==='rail'?55:90,ammoMax:opt.weapon==='rapid'?180:opt.weapon==='rail'?55:90,heat:0,over:false,scoreMul:1};
  helis=[];bombs=[];shots=[];exps=[];particles=[];pickups=[];clouds=[];score=0;kills=0;wave=1;missionTime=opt.time;elapsed=0;shake=0;flash=0;fireCd=0;spawnCd=0;bossSpawned=false;combo=0;comboTimer=0;
  for(let i=0;i<9;i++)clouds.push({x:rnd(0,W),y:rnd(H*.09,H*.38),s:rnd(.6,1.8),v:rnd(4,14)});
  for(let i=0;i<3+opt.diff;i++)spawnHeli();
  state='play';show('game');booting=false;if(musicOn)startMusic();
}
function difficulty(){return clamp(elapsed/(opt.time*.72),0,1)}
function weaponInfo(){
  if(opt.weapon==='rapid')return {rate:.095,damage:20,speed:950,spread:.025,heat:6,ammoCost:1,name:'RAPID'};
  if(opt.weapon==='rail')return {rate:.52,damage:72,speed:1500,spread:.003,heat:28,ammoCost:1,name:'RAIL'};
  return {rate:.18,damage:36,speed:1150,spread:.012,heat:12,ammoCost:1,name:'CANNON'};
}
function spawnHeli(){
  const d=difficulty(),side=Math.random()<.5?-1:1,elite=Math.random()<(.06+d*.16+opt.diff*.04),boss=false;
  const hp=(elite?90:48)+d*45+opt.diff*22;
  helis.push({x:side<0?rnd(-150,-55):rnd(W+55,W+150),y:rnd(H*.13,H*.42),z:rnd(.55,1.12),vx:side<0?rnd(34,70)+d*28:-(rnd(34,70)+d*28),hp,maxHp:hp,drop:rnd(.7,1.8),bob:rnd(0,7),elite,boss,dead:false,label:elite?'ELITE HELI':'ATTACK HELI',reload:rnd(.8,1.8)});
}
function spawnBoss(){
  const hp=360+opt.diff*120;
  helis.push({x:W+180,y:H*.18,z:1.3,vx:-28,hp,maxHp:hp,drop:.55,bob:0,elite:true,boss:true,dead:false,label:'BOSS GUNSHIP',reload:.6});
}
function fire(){
  const info=weaponInfo();
  if(state!=='play'||p.over||fireCd>0||p.ammo<info.ammoCost)return;
  p.ammo-=info.ammoCost;p.heat+=info.heat;fireCd=info.rate;flash=.08;shake=Math.max(shake,5);comboTimer=1.6;
  const a=p.angle+rnd(-info.spread,info.spread);
  const muzzle={x:W/2+Math.cos(a)*44,y:H*.74+Math.sin(a)*44};
  shots.push({x:muzzle.x,y:muzzle.y,vx:Math.cos(a)*info.speed,vy:Math.sin(a)*info.speed,life:.9,damage:info.damage,rail:opt.weapon==='rail'});
  beep(opt.weapon==='rail'?220:opt.weapon==='rapid'?760:540,.05,opt.weapon==='rail'?'sawtooth':'square',.04);
}
function boom(x,y,big=false){exps.push({x,y,life:big?.65:.35,max:big?.65:.35,r:big?46:24});shake=Math.max(shake,big?9:4);beep(big?80:145,big?.16:.08,'sawtooth',big?.045:.03);for(let i=0;i<(big?24:10);i++)particles.push({x,y,vx:rnd(-110,110),vy:rnd(-110,70),life:rnd(.25,.75),c:Math.random()<.55?'#ffda65':'#ff4a2c'});}
function hitPlayer(dmg){if(p.shield>0){const s=Math.min(p.shield,dmg*.65);p.shield-=s;dmg-=s}p.hp-=dmg;shake=10;boom(W/2,H*.78,false);if(p.hp<=0)end(false);}
function update(dt){
  if(state!=='play')return;elapsed+=dt;missionTime-=dt;fireCd-=dt;spawnCd-=dt;comboTimer-=dt;if(comboTimer<=0)combo=0;
  const d=difficulty(); if(missionTime<=0)end(true);
  if(!bossSpawned&&elapsed>opt.time*.68){bossSpawned=true;spawnBoss();}
  const targetCount=3+Math.floor(d*4)+opt.diff+(bossSpawned?1:0); while(helis.filter(h=>!h.boss).length<targetCount)spawnHeli();
  if(keys.ArrowLeft||keys.a||touch.left)p.angle-=2.7*dt;if(keys.ArrowRight||keys.d||touch.right)p.angle+=2.7*dt;p.angle=clamp(p.angle,-PI+.2,-.2);
  if(keys[' ']||touch.fire)fire();
  p.heat=Math.max(0,p.heat-dt*34);if(p.heat>100)p.over=true;else if(p.over&&p.heat<62)p.over=false;p.ammo=Math.min(p.ammoMax,p.ammo+dt*(opt.weapon==='rail'?3.5:7));
  if(p.shield<70)p.shield+=dt*2.8;
  clouds.forEach(c=>{c.x+=c.v*dt;if(c.x>W+80){c.x=-110;c.y=rnd(H*.08,H*.36);}});
  helis.forEach(h=>{h.x+=h.vx*dt;h.bob+=dt*3;h.drop-=dt*(1+d*.35+opt.diff*.08);h.reload-=dt; if(h.boss){h.y=H*.18+Math.sin(elapsed*1.5)*H*.04;if(h.x<W*.68)h.vx=18;if(h.x>W*.88)h.vx=-22}
    if(h.drop<=0){const count=h.boss?2:1;for(let i=0;i<count;i++)bombs.push({x:h.x+rnd(-18,18),y:h.y+28,z:h.z,vx:rnd(-16,16),vy:rnd(80,130)+d*45+opt.diff*20,spin:rnd(0,7),hp:h.boss?2:1,kind:h.boss?'MISSILE':'BOMB'});h.drop=rnd(.7,1.9)-d*.35-opt.diff*.08;if(h.boss)h.drop=.45}
    if(h.x<-190||h.x>W+190){h.dead=true;}
  });
  shots.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;});
  bombs.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.vy+=58*dt;b.spin+=7*dt;});
  // collisions: shots with helis and bombs
  for(const s of shots){
    for(const h of helis){if(h.dead)continue;const hitW=(h.boss?72:42)*h.z,hitH=(h.boss?34:23)*h.z;if(Math.abs(s.x-h.x)<hitW&&Math.abs(s.y-(h.y+Math.sin(h.bob)*6))<hitH){h.hp-=s.damage;s.life=s.rail?s.life:0;score+=12;combo++;comboTimer=1.6;boom(s.x,s.y,false);if(h.hp<=0){h.dead=true;kills++;score+=Math.floor((h.boss?2200:h.elite?650:330)*(1+combo*.08));boom(h.x,h.y,true);if(Math.random()<.25||h.boss)pickups.push({x:h.x,y:h.y,type:Math.random()<.55?'ammo':'shield',life:8});}}}
    for(const b of bombs){if(Math.hypot(s.x-b.x,s.y-b.y)<(b.kind==='MISSILE'?24:18)){b.hp--;s.life=s.rail?s.life:0;if(b.hp<=0){b.dead=true;score+=80;combo++;boom(b.x,b.y,false);}}}
  }
  bombs.forEach(b=>{if(b.dead)return;if(b.y>H*.74&&Math.abs(b.x-W/2)<W*.22){b.dead=true;hitPlayer(b.kind==='MISSILE'?24:15)}else if(b.y>H+60)b.dead=true;});
  pickups.forEach(u=>{u.y+=30*dt;u.life-=dt;if(u.y>H*.72&&Math.abs(u.x-W/2)<W*.28){if(u.type==='ammo')p.ammo=Math.min(p.ammoMax,p.ammo+p.ammoMax*.35);else p.shield=Math.min(90,p.shield+28);u.dead=true;beep(880,.07,'triangle',.035);}});
  particles.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=190*dt;q.life-=dt;});
  exps.forEach(e=>e.life-=dt);
  helis=helis.filter(h=>!h.dead);bombs=bombs.filter(b=>!b.dead&&b.y<H+80);shots=shots.filter(s=>s.life>0&&s.x>-80&&s.x<W+80&&s.y>-80&&s.y<H+80);exps=exps.filter(e=>e.life>0);particles=particles.filter(q=>q.life>0);pickups=pickups.filter(u=>!u.dead&&u.life>0);shake=Math.max(0,shake-dt*18);
}
function end(win){if(state!=='play')return;state='over';if(musicTimer){clearInterval(musicTimer);musicTimer=null}hi=Math.max(hi,Math.floor(score));try{localStorage.setItem('retroHeliHi',hi)}catch(e){}$('overTitle').textContent=win?'MISSION CLEAR':'GAME OVER';$('overText').innerHTML=`SCORE ${Math.floor(score)} · HI ${hi} · KILL ${kills} · WAVE ${wave}<br>무기 ${weaponInfo().name} · 난이도 ${['훈련','보통','하드'][opt.diff]} · 생존 시간 ${Math.floor(elapsed)}초`;show('over');}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function text(t,x,y,sz=18,c='#fff',align='left'){ctx.fillStyle=c;ctx.font=`900 ${sz}px Impact,Arial Black,system-ui`;ctx.textAlign=align;ctx.fillText(t,x,y);}
function draw(){
  const ox=(Math.random()-.5)*shake,oy=(Math.random()-.5)*shake;ctx.save();ctx.translate(ox,oy);drawScene();if(p){drawObjects();drawWeapon();drawHud();}ctx.restore();crt();
}
function drawScene(){
  const sky=ctx.createLinearGradient(0,0,0,H*.67);sky.addColorStop(0,'#0c3479');sky.addColorStop(.58,'#6eb4f2');sky.addColorStop(1,'#d8c78c');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=.75;clouds.forEach(c=>{rect(c.x,c.y,38*c.s,8*c.s,'#dcecff');rect(c.x+22*c.s,c.y-7*c.s,44*c.s,9*c.s,'#edf7ff');rect(c.x+55*c.s,c.y,32*c.s,7*c.s,'#c6d9e8');});ctx.globalAlpha=1;
  for(let i=0;i<8;i++){const x=i*(W/6)-80,peak=H*.50+(i%3)*20;ctx.fillStyle=i%2?'#263e52':'#314c61';ctx.beginPath();ctx.moveTo(x,H*.67);ctx.lineTo(x+W*.16,peak);ctx.lineTo(x+W*.34,H*.67);ctx.fill();ctx.fillStyle='#d8d4be';ctx.beginPath();ctx.moveTo(x+W*.16,peak);ctx.lineTo(x+W*.11,peak+45);ctx.lineTo(x+W*.21,peak+39);ctx.fill();}
  rect(0,H*.67,W,H*.08,'#344635');for(let x=0;x<W;x+=24){rect(x,H*.63,3,H*.15,'#5e6a6a');rect(x,H*.65,24,2,'#819093');rect(x,H*.69,24,2,'#485353');}
  const runway=ctx.createLinearGradient(0,H*.75,0,H);runway.addColorStop(0,'#5c4a2e');runway.addColorStop(1,'#120d08');ctx.fillStyle=runway;ctx.fillRect(0,H*.75,W,H*.25);
  for(let y=H*.78;y<H;y+=28){ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(0,y,W,3)}

  if(IMG.bgCity && IMG.bgCity.ready){
    ctx.globalAlpha = .55;
    ctx.drawImage(IMG.bgCity, 0, H*.365, W, H*.245);
    ctx.globalAlpha = 1;
  }
  // bunker and tower
  rect(W*.04,H*.61,W*.08,H*.14,'#30393a');rect(W*.055,H*.56,6,H*.18,'#526063');rect(W*.085,H*.56,6,H*.18,'#526063');rect(W*.062,H*.535,11,14,'#df3c2e');
  rect(W*.74,H*.68,W*.17,H*.055,'#c7c5aa');text('DANGER',W*.755,H*.705,landscape?20:17,'#a22626');text('KEEP OUT',W*.755,H*.728,landscape?15:13,'#232b33');
}
function drawHeli(h){
  const flip=h.vx>=0?1:-1,x=h.x,y=h.y+Math.sin(h.bob)*7,s=h.boss?2.0*h.z:(h.elite?1.35*h.z:1.0*h.z);
  const assetKey = h.boss ? 'bossGunship' : (h.elite ? 'eliteHeli' : 'attackHeli');
  const aw = (h.boss?190:118)*s, ah=(h.boss?82:54)*s;
  if(!drawAsset(assetKey, x, y, aw, ah, flip, 0)){
    ctx.save();ctx.translate(x,y);ctx.scale(flip*s,s);
    rect(-44,-27,90,4,'#e0e2dc');rect(-8,-23,17,5,'#555'); if(h.boss){rect(-78,-32,42,4,'#e0e2dc');rect(-65,-28,12,4,'#555');}
    rect(-74,-7,52,10,'#2c3a1b');rect(-91,-15,22,26,'#465b26');rect(-100,-3,18,4,'#ddd');rect(-92,-12,4,22,'#ddd');
    rect(-24,-20,60,38,h.boss?'#4c3a2a':h.elite?'#5b4827':'#405225');rect(-10,-26,44,12,h.elite?'#8e7b32':'#6f7f3b');
    rect(32,-12,27,24,'#6bd1e0');rect(40,-6,14,12,'#bdf8ff');rect(-8,14,42,8,'#151a10');rect(-18,23,72,4,'#8d9371');rect(-10,19,7,17,'#222');rect(18,19,7,17,'#222');
    if(h.elite){rect(-18,-3,12,5,'#ffcf54');rect(8,-3,12,5,'#ffcf54');}
    ctx.restore();
  }
  const bw=(h.boss?150:74)*h.z,bh=6;
  rect(x-bw/2,y-(h.boss?74:48)*h.z,bw,bh,'#210');
  rect(x-bw/2,y-(h.boss?74:48)*h.z,bw*(h.hp/h.maxHp),bh,h.boss?'#ff4949':'#ffe25c');
}
function drawBomb(b){
  const key = b.kind === 'MISSILE' ? 'missile' : 'bomb';
  const sz = b.kind === 'MISSILE' ? 34 : 26;
  if(drawAsset(key, b.x, b.y, sz, sz*1.55, 1, b.spin)) return;
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.spin);const s=b.kind==='MISSILE'?1.35:1;rect(-5*s,-10*s,10*s,18*s,'#1f2937');rect(-6*s,5*s,12*s,5*s,'#9ca3af');rect(-2*s,-18*s,4*s,8*s,'#ffcf4b');rect(-4*s,-13*s,8*s,5*s,'#ff4728');ctx.restore();
}
function drawObjects(){
  helis.sort((a,b)=>a.z-b.z).forEach(drawHeli);bombs.forEach(drawBomb);
  shots.forEach(s=>{ctx.strokeStyle=s.rail?'#9ff7ff':'#fff29b';ctx.lineWidth=s.rail?4:3;ctx.beginPath();ctx.moveTo(s.x-s.vx*.025,s.y-s.vy*.025);ctx.lineTo(s.x,s.y);ctx.stroke();});
  pickups.forEach(u=>{rect(u.x-13,u.y-13,26,26,u.type==='ammo'?'#2f86ff':'#37df73');text(u.type==='ammo'?'A':'S',u.x,u.y+7,22,'#fff','center');});
  particles.forEach(q=>{ctx.globalAlpha=Math.max(0,q.life/.7);rect(q.x,q.y,4,4,q.c);ctx.globalAlpha=1;});
  exps.forEach(e=>{const p=e.life/e.max,r=e.r*(1-p+.2);ctx.globalAlpha=p;rect(e.x-r/2,e.y-r/2,r,r,'#ffec72');rect(e.x-r,e.y-4,r*2,8,'#ff862e');rect(e.x-4,e.y-r,8,r*2,'#ff3b28');ctx.globalAlpha=1;});
}
function drawWeapon(){
  const baseY=H*.74, cx=W/2, a=p.angle+PI/2;ctx.save();ctx.translate(cx,baseY);ctx.rotate(a);
  rect(-12,-88,24,90,'#555b60');rect(-8,-98,16,15,'#d6d7d5');rect(-20,-8,40,22,'#202429');ctx.restore();
  rect(cx-95,baseY-5,190,52,'#24282e');rect(cx-70,baseY+10,140,40,'#b09255');rect(cx-42,baseY-20,84,36,'#555c63');rect(cx-26,baseY-30,52,20,'#aeb4b7');
  ctx.strokeStyle='#fff';ctx.lineWidth=landscape?3:4;ctx.beginPath();ctx.arc(cx,H*.47,landscape?18:22,0,PI*2);ctx.moveTo(cx-48,H*.47);ctx.lineTo(cx-13,H*.47);ctx.moveTo(cx+13,H*.47);ctx.lineTo(cx+48,H*.47);ctx.moveTo(cx,H*.47-48);ctx.lineTo(cx,H*.47-13);ctx.moveTo(cx,H*.47+13);ctx.lineTo(cx,H*.47+48);ctx.stroke();
  if(flash>0){ctx.globalAlpha=flash*8;ctx.fillStyle='#fff1a8';ctx.beginPath();ctx.arc(cx+Math.cos(p.angle)*60,baseY+Math.sin(p.angle)*60,60*flash*7,0,PI*2);ctx.fill();ctx.globalAlpha=1;}
}
function aimedTarget(){let best=null,bd=1e9;for(const h of helis){const da=Math.atan2(h.y-H*.74,h.x-W/2)-p.angle,ad=Math.abs(Math.atan2(Math.sin(da),Math.cos(da)));const dist=Math.hypot(h.x-W/2,h.y-H*.74);if(ad<.12&&dist<bd){best=h;bd=dist}}for(const b of bombs){const da=Math.atan2(b.y-H*.74,b.x-W/2)-p.angle,ad=Math.abs(Math.atan2(Math.sin(da),Math.cos(da)));const dist=Math.hypot(b.x-W/2,b.y-H*.74);if(ad<.10&&dist<bd){best=b;bd=dist}}return best;}
function drawTargetBanner(){
  const target=aimedTarget();if(!target)return;const name=target.kind||target.label||'TARGET',pulse=.5+.5*Math.sin(performance.now()/90),x=W/2,y=landscape?H*.18:H*.16,bw=Math.min(W*.82,340),bh=landscape?54:66;
  ctx.fillStyle='rgba(20,0,0,.68)';ctx.fillRect(x-bw/2,y-bh/2,bw,bh);ctx.strokeStyle=`rgba(255,68,48,${.7+pulse*.3})`;ctx.lineWidth=3;ctx.strokeRect(x-bw/2+3,y-bh/2+3,bw-6,bh-6);text('LOCK: '+name,x,y-4,landscape?25:30,'#fff2a8','center');text('격추하라!',x,y+24,landscape?14:17,'#ff5f4b','center');
}
function drawHud(){
  rect(0,0,W,landscape?62:78,'rgba(0,0,0,.58)');text('1UP',14,34,28,'#64e4ff');text(String(Math.floor(score)).padStart(6,'0'),82,34,28,'#fff');text('HI '+String(hi).padStart(6,'0'),W/2-60,34,24,'#8cff58');text('STAGE '+(opt.diff+1),W-150,34,26,'#ffdf75');
  text('TIME '+Math.ceil(missionTime).toString().padStart(2,'0'),W/2-50,landscape?58:66,18,'#fff');text('KILL '+kills,20,landscape?58:66,18,'#ffdf75');text(weaponInfo().name,W-120,landscape?58:66,18,'#ffdf75');
  // bars bottom
  rect(0,H-74,W,74,'rgba(0,0,0,.50)');bar(18,H-58,130,14,p.hp/100,'#ff4d4d','HP');bar(18,H-36,130,14,p.shield/90,'#43b7ff','SHIELD');bar(W-172,H-58,150,14,p.ammo/p.ammoMax,'#ffdf5c','AMMO');bar(W-172,H-36,150,14,1-p.heat/100,p.over?'#ff3b2e':'#63ff65','COOL');
  if(combo>1)text('COMBO x'+combo,W/2,H*.25,landscape?25:34,'#ffdf75','center');
  if(p.over)text('OVERHEAT!',W/2,H*.62,landscape?28:38,'#ff4a3c','center');
  radar();controls();drawTargetBanner();
}
function bar(x,y,w,h,v,c,label){v=clamp(v,0,1);rect(x,y,w,h,'#101820');rect(x+2,y+2,(w-4)*v,h-4,c);text(label,x+5,y+h-3,11,'#fff');}
function radar(){const r=landscape?46:56,cx=r+10,cy=landscape?115:145;ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,PI*2);ctx.clip();rect(cx-r,cy-r,r*2,r*2,'rgba(12,38,48,.75)');ctx.strokeStyle='rgba(120,255,220,.25)';for(let k=1;k<4;k++){ctx.beginPath();ctx.arc(cx,cy,r*k/4,0,PI*2);ctx.stroke();}ctx.strokeStyle='rgba(255,255,255,.45)';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(p.angle)*r,cy+Math.sin(p.angle)*r);ctx.stroke();helis.forEach(h=>{const x=cx+(h.x-W/2)/W*r*1.6,y=cy+(h.y-H*.45)/H*r*2.2;rect(x-2,y-2,5,5,h.boss?'#ff3030':h.elite?'#ffcf4b':'#ff6a6a');});bombs.forEach(b=>{const x=cx+(b.x-W/2)/W*r*1.6,y=cy+(b.y-H*.45)/H*r*2.2;rect(x-1,y-1,3,3,'#fff');});ctx.restore();ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,r,0,PI*2);ctx.stroke();}
function controls(){const jy=H-178,jx=landscape?105:96,frx=W-98,fry=H-178;ctx.globalAlpha=.45;ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(jx,jy,landscape?56:70,0,PI*2);ctx.stroke();text('AIM',jx,jy+7,18,'#fff','center');ctx.beginPath();ctx.arc(frx,fry,landscape?45:55,0,PI*2);ctx.stroke();text('FIRE',frx,fry+7,18,'#fff','center');ctx.globalAlpha=1;}
function crt(){ctx.globalAlpha=.10;ctx.fillStyle='#000';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);ctx.globalAlpha=.22;ctx.strokeStyle='#000';ctx.lineWidth=10;ctx.strokeRect(0,0,W,H);ctx.globalAlpha=1;}
function loop(ts){const dt=Math.min(.033,(ts-last)/1000||.016);last=ts;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);

addEventListener('keydown',e=>{keys[e.key]=1;keys[e.key.toLowerCase()]=1;if(e.key==='Escape'||e.key.toLowerCase()==='p')pause();if(e.key===' ')e.preventDefault();});
addEventListener('keyup',e=>{keys[e.key]=0;keys[e.key.toLowerCase()]=0;});
function canvasPos(e){const r=cvs.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
function inCircle(x,y,cx,cy,r){return Math.hypot(x-cx,y-cy)<=r;}
function fireButton(){return {x:W-98,y:H-178,r:landscape?68:82};}
function aimButton(){return {x:landscape?105:96,y:H-178,r:landscape?76:92};}
cvs.addEventListener('pointerdown',e=>{
  if(state!=='play')return;
  const pnt=canvasPos(e);cvs.setPointerCapture(e.pointerId);
  const fb=fireButton(), ab=aimButton();
  // FIRE 버튼 영역은 조준 좌/우 입력과 완전히 분리한다.
  // 이전 버전은 오른쪽 영역 전체를 right+fire로 처리해서 FIRE를 누르면 우회전하는 문제가 있었다.
  if(inCircle(pnt.x,pnt.y,fb.x,fb.y,fb.r)){
    touch.fire=true;touch.fireId=e.pointerId;fire();return;
  }
  if(inCircle(pnt.x,pnt.y,ab.x,ab.y,ab.r)){
    if(pnt.x<ab.x){touch.left=true;touch.leftId=e.pointerId;}
    else{touch.right=true;touch.rightId=e.pointerId;}
    return;
  }
  // 중앙/상단 영역은 FPS식 스와이프 조준 + 첫 터치 발사
  touch.look=e.pointerId;touch.lookId=e.pointerId;touch.lastX=pnt.x;touch.fire=true;touch.fireId=e.pointerId;fire();
});
cvs.addEventListener('pointermove',e=>{
  if(state!=='play')return;
  const pnt=canvasPos(e);
  if(touch.lookId===e.pointerId){const dx=pnt.x-touch.lastX;p.angle=clamp(p.angle+dx*.0045,-PI+.2,-.2);touch.lastX=pnt.x;}
  if(touch.leftId===e.pointerId||touch.rightId===e.pointerId){
    const ab=aimButton();
    touch.left=touch.leftId===e.pointerId && pnt.x<ab.x;
    touch.right=touch.rightId===e.pointerId && pnt.x>=ab.x;
  }
});
function clearTouch(e){
  if(touch.leftId===e.pointerId){touch.left=false;touch.leftId=null;}
  if(touch.rightId===e.pointerId){touch.right=false;touch.rightId=null;}
  if(touch.fireId===e.pointerId){touch.fire=false;touch.fireId=null;}
  if(touch.lookId===e.pointerId){touch.look=false;touch.lookId=null;}
}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>cvs.addEventListener(ev,clearTouch));
function pause(){if(state==='play'){state='pause';show('pause');if(musicTimer){clearInterval(musicTimer);musicTimer=null}}}
function goMain(){state='main';show('main');if(musicTimer){clearInterval(musicTimer);musicTimer=null}updateMusicButtons();}
$('startBtn').onclick=()=>{ensureAudio();reset();};$('resumeBtn').onclick=()=>{state='play';show('game');if(musicOn)startMusic();};$('restartBtn').onclick=()=>reset();$('pauseMainBtn').onclick=goMain;$('overRestart').onclick=()=>reset();$('overMain').onclick=goMain;$('mainBtn').onclick=goMain;$('pauseBtn').onclick=pause;$('musicBtn').onclick=toggleMusic;$('mainMusicBtn').onclick=toggleMusic;$('exitBtn').onclick=()=>show('exit');$('backMainBtn').onclick=goMain;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});

window.__retroHeliTest={
  start:()=>{ensureAudio();reset();},
  state:()=>({state,W,H,landscape,angle:p?p.angle:null,ammo:p?p.ammo:null,touch:{left:touch.left,right:touch.right,fire:touch.fire,leftId:touch.leftId,rightId:touch.rightId,fireId:touch.fireId,lookId:touch.lookId}}),
  firePoint:()=>fireButton(),
  aimPoint:()=>aimButton()
};
updateMusicButtons();
})();

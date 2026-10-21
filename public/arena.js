'use strict';
const canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let cameraX=160,frameTime=0,lastSend=0,audio=null,particles=[],smoothed=new Map(),animTimers=new Map();
// Client-side animation clocks continue between server snapshots (15Hz).
// Action changes restart at frame zero; ordinary run/dribble cycles persist.
function animationTime(id,animation,dt,playing=true){
  const current=animTimers.get(id);
  if(!current||current.animation!==animation){
    animTimers.set(id,{animation,elapsed:0});return 0;
  }
  if(playing)current.elapsed+=Math.max(0,Math.min(.06,dt));
  return current.elapsed;
}

function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))}
function line(c,x,y,x2,y2,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(Math.round(x)+.5,Math.round(y)+.5);c.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);c.stroke()}
function txt(c,value,x,y,size,color='#fff',align='left'){
  c.font='900 '+size+'px monospace';c.textAlign=align;c.textBaseline='middle';
  c.fillStyle='#07132a';c.fillText(String(value),x+2,y+2);
  c.fillStyle=color;c.fillText(String(value),x,y);
}
function drawAvatar(c,p,team,x,y,s,time,anim,fire){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
  const px=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
  const wave=anim==='run'||anim==='dribble'?Math.round(Math.sin(time*12+(p.name?.length||0))*3):Math.round(Math.sin(time*2));
  const raised=['jump','dunk','shoot'].includes(anim);
  // Original procedural pixel character, 32x50 logical pixels.
  px(-13,1,26,3,'#131b30aa');
  px(-12,-11+wave,10,11,'#17223a');px(2,-11-wave,10,11,'#17223a');
  px(-12,0+wave,12,4,'#f1f1e5');px(2,0-wave,12,4,'#f1f1e5');
  px(-12,-27,24,20,'#142037');px(-10,-26,20,17,team.primary);
  px(-10,-14,20,4,team.secondary);px(-7,-24,4,12,'#ffffff26');px(-3,-24,6,9,team.secondary);
  px(-16,-26+(raised?-7:wave),6,raised?10:16,'#16233c');
  px(10,-26+(raised?-7:-wave),6,raised?10:16,'#16233c');
  px(-15,-26+(raised?-7:wave),4,raised?10:16,p.skin);
  px(11,-26+(raised?-7:-wave),4,raised?10:16,p.skin);
  if(raised){px(-15,-36,4,9,p.skin);px(11,-37,4,9,p.skin)}
  px(-10,-43,20,20,'#152139');px(-9,-42,18,17,p.skin);
  px(-9,-42,18,4,p.hair);
  switch(p.hairStyle){
    case 'ponytail':px(9,-41,6,16,p.hair);px(11,-28,4,6,p.hair);break;
    case 'spikes':px(-10,-45,5,8,p.hair);px(-4,-48,7,9,p.hair);px(5,-45,6,8,p.hair);break;
    case 'long':px(-11,-41,4,24,p.hair);px(8,-41,4,24,p.hair);break;
    case 'bob':px(-11,-42,5,19,p.hair);px(7,-42,5,19,p.hair);break;
    case 'waves':px(-12,-42,6,9,p.hair);px(7,-42,5,9,p.hair);px(-11,-31,4,12,p.hair);break;
    case 'curly':for(let i=0;i<5;i++)px(-10+i*4,-46+i%2*2,5,6,p.hair);break;
    case 'cap':px(-10,-46,20,7,p.hair);px(3,-41,11,4,team.secondary);break;
    case 'buzz':px(-9,-43,18,2,p.hair);break;
    case 'side':px(-10,-44,20,7,p.hair);px(-9,-39,6,4,p.hair);break;
    default:px(-9,-44,18,7,p.hair);
  }
  px(-4,-33,2,2,'#202839');px(5,-33,2,2,'#202839');
  px(-2,-27,5,1,'#9e534c');px(-7,-41,4,2,'#ffffff33');
  if(fire){px(-10,-51,5,8,'#fc7629');px(-3,-56,6,13,'#ffdc54');px(7,-50,5,7,'#f6682b')}
  c.restore();
}
function drawBall(c,x,y,r=6){
  c.beginPath();c.fillStyle='#512c23';c.arc(x,y,r+1,0,7);c.fill();
  c.beginPath();c.fillStyle='#f3983d';c.arc(x,y,r,0,7);c.fill();
  line(c,x-r,y,x+r,y,'#723d29');line(c,x,y-r,x,y+r,'#723d29');
  c.beginPath();c.strokeStyle='#713b21';c.lineWidth=1;c.arc(x,y,r*.7,-1,1);c.stroke();
}
function court(c,cam,time){
  rect(c,0,0,640,360,'#101d39');
  rect(c,0,0,640,120,'#142341');
  rect(c,0,19,640,13,'#334767');
  for(let i=0;i<17;i++){
    const x=i*41-(cam*.05%41);
    rect(c,x,2,20,4,'#bbc8d4');rect(c,x+2,6,3,'#93effc');rect(c,x+13,9,2,'#e4a76a');
  }
  for(let r=0;r<5;r++)for(let i=0;i<92;i++){
    const x=i*8+(r%2)*4-cam*.035,y=42+r*14;
    const bright=Math.sin(time*2+i*4+r*5)>.94;
    rect(c,x,y,5,6,bright?['#e9b77d','#b6e992','#95dafa','#e29ce7'][i%4]:['#434b65','#5c4a63','#3a5470','#665973'][i%4]);
    rect(c,x-1,y+6,7,4,'#202b4b');
  }
  rect(c,0,114,640,6,'#ffca78');
  rect(c,0,120,640,202,'#603d38');
  const left=-cam;
  rect(c,left,124,960,180,'#cc8953');
  for(let i=0;i<49;i++){
    const x=left+i*20;
    rect(c,x,125,2,177,i%2?'#d89d6b':'#b5774a');
    for(let y=127;y<304;y+=24)line(c,x,y,x+18,y,'#b8784f');
  }
  rect(c,left,122,960,4,'#ffedb0');rect(c,left,303,960,4,'#ffedb0');
  line(c,left,124,left,305,'#ffedb0',3);line(c,left+960,124,left+960,305,'#ffedb0',3);
  line(c,left+480,124,left+480,304,'#ffe9b6',3);
  c.strokeStyle='#ffecb1';c.lineWidth=3;c.beginPath();c.ellipse(left+480,213,70,59,0,0,7);c.stroke();
  for(const rim of [83,877]){
    const x=rim+left,sign=rim===83?1:-1;
    c.beginPath();c.ellipse(x,212,219,100,0,Math.PI*.52,Math.PI*1.48);c.stroke();
    rect(c,x+(sign===1?-2:-110),158,110,112,'#f8e4a01b');
    line(c,x+sign*91,158,x+sign*91,266,'#ffedbb',2);
    c.beginPath();c.ellipse(x+sign*91,211,29,29,0,0,7);c.stroke();
  }
  rect(c,0,308,640,52,'#111932');rect(c,0,310,640,4,'#ffd187');
  for(let i=0;i<23;i++){rect(c,i*29,324,18,3,'#344972');rect(c,i*29+7,333,11,2,'#536a97')}
}
function hoop(c,worldX,cam,front){
  const x=Math.round(worldX-cam);if(x< -45||x>685)return;
  const sign=worldX===83?1:-1;
  if(!front){
    rect(c,x-sign*21,83,6,118,'#8196a8');
    rect(c,x-sign*27,110,32,38,'#d5e8e9');
    rect(c,x-sign*24,113,26,30,'#344d72');
    rect(c,x-sign*21,117,20,22,'#e9eef3');
    rect(c,x-sign*8,139,10,5,'#ff9345');
  }else{
    rect(c,x-15,150,30,5,'#ec6d35');rect(c,x-15,155,30,3,'#ffc96d');
    for(let i=-13;i<=13;i+=6)line(c,x+i,159,x+i*.54,173,'#e4f8df');
    line(c,x-8,173,x+8,173,'#f0fffc');
  }
}
function arcadeSound(kind){
  try{
    audio=audio||new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const f={score:670,dunk:140,block:105,shot:350,pass:300,steal:470,fire:700,whistle:800,rim:230,rebound:320}[kind]||370;
    const osc=audio.createOscillator(),vol=audio.createGain();osc.type=kind==='dunk'?'sawtooth':'square';
    osc.frequency.setValueAtTime(f,audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30,f*.6),audio.currentTime+.16);
    vol.gain.setValueAtTime(.05,audio.currentTime);vol.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.19);
    osc.connect(vol).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.2);
  }catch{}
}
function makeBurst(kind){
  const colors=kind==='dunk'?['#ffa94f','#ffe657','#ff6d3a']:['#beff79','#e5e8f8','#7cf9f3'];
  for(let i=0;i<35;i++)particles.push({x:320,y:100,vx:(Math.random()-.5)*360,vy:(Math.random()-.6)*260,ttl:.9,color:colors[i%3]});
}
function renderGame(now,dt){
  const g=game;if(!g||!room)return;
  const c=ctx;c.imageSmoothingEnabled=false;
  const teams=(g.teams||[room.myTeam,room.roster[1].id]).map(id=>room.roster.find(t=>t.id===id)||room.roster[0]);
  const mySide=room.mySide??0,controlled=g.players.find(p=>p.id===room.control);
  const focus=controlled||g.players[mySide*2];
  const aim=Math.max(0,Math.min(320,(focus?.x??480)-320));
  cameraX+=(aim-cameraX)*Math.min(1,dt*5);
  const time=now/1000;court(c,cameraX,time);
  hoop(c,83,cameraX,false);hoop(c,877,cameraX,false);
  for(const p of [...g.players].sort((a,b)=>a.y-b.y)){
    const team=teams[p.side];
    let sm=smoothed.get(p.id);if(!sm){sm={x:p.x,y:p.y};smoothed.set(p.id,sm)}
    sm.x+=(p.x-sm.x)*Math.min(1,dt*14);sm.y+=(p.y-sm.y)*Math.min(1,dt*14);
    const x=sm.x-cameraX,y=sm.y-p.z;
    if(x< -50||x>690)continue;
    c.fillStyle='#2a283588';c.beginPath();c.ellipse(x,p.y+3,16,5,0,0,7);c.fill();
    const animation=p.dunkTime>0?'dunk':p.anim;
    const elapsed=animationTime(p.id,animation,dt,g.phase==='PLAY'&&!g.pause);
    if(!SpriteArt.draw(c,p,x,y,1.08,time,animation,{face:p.face,direction:p.facing8,animTime:elapsed})){
      drawAvatar(c,p,team,x,y,1.32,time,animation,g.fireId===p.id);
    }
    const human=g.controllers?.find(m=>m.slot===p.id);
    if(human){rect(c,x-18,y-71,36,13,'#172b49');txt(c,human.initials,x,y-65,10,'#ffeda7','center')}
    if(p.id===room.control){
      c.beginPath();c.strokeStyle='#faff89';c.lineWidth=2;c.ellipse(x,p.y+5,20,7,0,0,7);c.stroke();
      rect(c,x-17,p.y+12,34,5,'#152438');rect(c,x-16,p.y+13,32*p.stamina/100,3,'#91ff98');
    }
    if(p.hasBall&&g.ball.mode==='held'){
      // The basketball is still a separate physics object, but its visual
      // hand position now follows the 8-way athlete artwork.
      const facing=Number.isInteger(p.facing8)?p.facing8:(p.face<0?6:2);
      const handX=[-11,10,16,15,12,-15,-16,-10][facing];
      const handY=[-15,-15,-14,-13,-13,-13,-14,-15][facing];
      drawBall(c,x+handX,y+handY-Math.abs(Math.sin(time*10))*9,6);
    }
    if(p.charge>0){rect(c,x-19,y-77,38,5,'#102143');rect(c,x-18,y-76,36*p.charge/1.12,3,p.charge>.82?'#ffb35a':'#c7ff82')}
  }
  const b=g.ball;
  if(b&&b.mode!=='held'&&b.mode!=='dead'){
    c.fillStyle='#24232b88';c.beginPath();c.ellipse(b.x-cameraX,b.y+3,8,3,0,0,7);c.fill();
    drawBall(c,b.x-cameraX,b.y-(b.z||0),6);
  }
  hoop(c,83,cameraX,true);hoop(c,877,cameraX,true);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;p.ttl-=dt;rect(c,p.x,p.y,4,4,p.color)}
  particles=particles.filter(p=>p.ttl>0);
  // High-contrast split-team scoreboard, clock and shot clock.
  rect(c,0,0,640,52,'#0b142d');rect(c,0,49,640,3,'#f6ae53');
  rect(c,7,6,186,37,teams[0].secondary);rect(c,449,6,184,37,teams[1].secondary);
  txt(c,teams[0].name.slice(0,18),14,17,11,teams[0].primary);
  txt(c,teams[1].name.slice(0,18),626,17,11,teams[1].primary,'right');
  txt(c,String(g.scores[0]).padStart(2,'0'),184,33,23,'#fff','right');
  txt(c,String(g.scores[1]).padStart(2,'0'),617,33,23,'#fff','right');
  txt(c,g.overtime?'OT':'Q'+g.quarter,225,15,12,'#d9f8a0');
  txt(c,Math.floor(g.clock/60)+':'+String(g.clock%60).padStart(2,'0'),321,18,20,'#fff','center');
  rect(c,369,4,70,40,'#443725');txt(c,'SHOT',404,14,10,'#ffcb88','center');
  txt(c,g.shotClock,405,31,20,g.shotClock<6?'#ff7475':'#fff','center');
  if(eventCall&&now<eventCall.until){
    txt(c,eventCall.text,320,95+Math.sin(time*11)*2,eventCall.text.length>20?18:29,
      eventCall.kind==='dunk'?'#ffb94b':'#bfff82','center');
  }
  if(g.phase==='OVER')txt(c,'FINAL!',320,110,41,'#f6d376','center');
}
function render(now){
  const dt=frameTime?Math.min((now-frameTime)/1000,.055):1/60;frameTime=now;
  if($('play').classList.contains('active')&&game)renderGame(now,dt);
  if(connected&&room?.phase==='game'&&now-lastSend>34){send({t:'input',keys});lastSend=now}
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

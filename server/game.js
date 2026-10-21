'use strict';
const {findPlayer,findTeam}=require('./roster');
const WIDTH=960, TOP=116, BOTTOM=304, HOOPS=[83,877], RIM_Y=204;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rand=(a,b)=>a+Math.random()*(b-a);
const goal=side=>HOOPS[side===0?1:0];
const dir=side=>side===0?1:-1;
// 0 N, 1 NE, 2 E, 3 SE, 4 S, 5 SW, 6 W, 7 NW.
function directionFromVector(dx,dy,fallback=4){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||dx*dx+dy*dy<.001)return fallback;
  return ((Math.round(Math.atan2(dx,-dy)/(Math.PI/4))%8)+8)%8;
}
function createGame(room) {
  let id=0;
  const players=[];
  for(let side=0;side<2;side++){
    const members=room.members.filter(m=>m.side===side);
    const selected=members.length?members.map(m=>m.pick):findTeam(room.sides[side].teamId).players.slice(0,2).map(p=>p.id);
    if(members.length===1)selected.push(members[0].support);
    // Empty side is allowed in solo mode; its two athletes are CPU-controlled.
    for(let slot=0;slot<2;slot++){
      const profile=findPlayer(room.sides[side].teamId,selected[slot]);
      if(!profile)throw Error('Unresolved draft pick');
      const owned=slot<members.length?members[slot].token:null;
      const p={...profile,id:id++,spriteId:profile.id,side,ownerToken:owned,
        x:side===0?270+slot*47:690-slot*47,y:slot?255:174,
        vx:0,vy:0,z:0,vz:0,face:dir(side),facing8:side===0?2:6,stamina:100,cooldown:0,blockWindow:0,
        charging:0,charge:0,dunkTime:0,anim:'idle',actionT:0,action:'',hasBall:false,input:{},prev:{},aiThink:0};
      players.push(p);
      if(owned)members[slot].control=p.id;
    }
    if(members.length===1)members[0].control=players[side*2].id;
  }
  const game={teams:room.sides.map(s=>s.teamId),phase:'PLAY',pause:false,clock:60,shotClock:24,quarter:1,overtime:false,
    scores:[0,0],players,ball:{mode:'held',owner:0,x:players[0].x,y:players[0].y,z:14},
    possession:0,events:[],eventId:0,pending:0,nextTeam:0,breakClock:0,fire:{id:-1,until:0},streak:{id:-1,count:0},elapsed:0};
  players[0].hasBall=true;
  return game;
}
function emit(g,text,kind='info'){g.eventId++;g.events=[{id:g.eventId,text,kind}];}
function give(g,p,kind='catch'){
  const prev=g.possession;
  for(const q of g.players)q.hasBall=false;
  p.hasBall=true;g.ball={mode:'held',owner:p.id,x:p.x,y:p.y,z:14};
  g.possession=p.side;
  if(prev!==p.side)g.shotClock=24;
  else if(kind==='rebound')g.shotClock=14;
  if(prev!==p.side&&kind==='interception')emit(g,'INTERCEPTED!','steal');
  if(kind==='rebound')emit(g,'REBOUND!','rebound');
}
function resetPossession(g,side){
  g.possession=side;g.shotClock=24;g.pending=0;
  g.players.forEach((p,i)=>{p.x=p.side===0?260+i%2*44:700-i%2*44;p.y=i%2?252:170;
    p.vx=p.vy=p.vz=p.z=0;p.cooldown=.3;p.charging=0;p.dunkTime=0;p.hasBall=false;p.input={};p.prev={}});
  const start=g.players[side*2];g.ball={mode:'held',owner:start.id,x:start.x,y:start.y,z:14};
  start.hasBall=true;emit(g,side===0?'LEFT TEAM BALL':'RIGHT TEAM BALL','whistle');
}
function score(g,side,points,shooter,dunk=false){
  if(g.phase!=='PLAY'||g.pending)return;
  g.scores[side]+=points;
  const s=g.streak;
  if(s.id===shooter)s.count++;else{s.id=shooter;s.count=1}
  const scorer=g.players.find(p=>p.id===shooter);
  if(scorer){scorer.action='celebrate';scorer.actionT=1}
  if(s.count>=3){g.fire={id:shooter,until:g.elapsed+18};emit(g,"HE'S ON FIRE!",'fire')}
  else emit(g,dunk?'BOOMSHAKALAKA!':points===3?'FROM DOWNTOWN!':'NOTHING BUT NET!',dunk?'dunk':'score');
  if(g.overtime){g.phase='OVER';g.ball={mode:'dead',owner:-1,x:goal(side),y:RIM_Y,z:20};return}
  g.ball={mode:'dead',owner:-1,x:goal(side),y:RIM_Y,z:20};g.pending=1.4;g.nextTeam=1-side;
}
function passBall(g,p){
  if(!p.hasBall||p.cooldown>0)return;
  const mate=g.players.find(q=>q.side===p.side&&q.id!==p.id);
  if(!mate)return;
  // Face the *receiver*, not the prior run direction, for pass animations.
  p.facing8=directionFromVector(mate.x-p.x,mate.y-p.y,p.facing8);
  p.face=mate.x<p.x?-1:mate.x>p.x?1:p.face;
  p.hasBall=false;p.cooldown=.36;p.charging=0;p.action='pass';p.actionT=.34;
  g.ball={mode:'pass',owner:-1,from:p.id,to:mate.id,side:p.side,x:p.x+p.face*12,y:p.y,z:22,
    sx:p.x+p.face*12,sy:p.y,sz:22,time:0,duration:clamp(dist(p,mate)/355,.27,.82)};
  emit(g,'NICE PASS!','pass');
}
function takeShot(g,p,power){
  if(!p.hasBall||p.cooldown>0)return;
  const gx=goal(p.side),range=Math.hypot((gx-p.x),(RIM_Y-p.y)*1.25);
  const three=range>239,pressure=g.players.filter(q=>q.side!==p.side)
      .reduce((v,q)=>v+(dist(q,p)<68?(68-dist(q,p))/68*.2:0),0);
  const stat=three?p.stats.three:(p.stats.three*.43+p.stats.dunk*.57);
  const ideal=.65;
  const perfect=1-Math.min(1,Math.abs(power-ideal)/.85);
  const odds=clamp(.17+stat/100*.58+perfect*.19-pressure-(three?.13:0),.08,.94);
  const made=Math.random()<odds;
  p.hasBall=false;p.cooldown=.55;p.charging=0;p.anim='shoot';p.action='shoot';p.actionT=.55;
  const duration=clamp(.53+range/590,.65,1.7);
  g.ball={mode:'shot',owner:-1,shooter:p.id,side:p.side,points:three?3:2,
    x:p.x,y:p.y,z:28+p.z,sx:p.x,sy:p.y,sz:28+p.z,tx:gx+(made?0:rand(-38,38)),
    ty:RIM_Y+(made?0:rand(-25,25)),time:0,duration,made,rim:false};
  emit(g,three?'THREE BALL!':'UP FOR TWO!','shot');
}
function startDunk(g,p){
  if(!p.hasBall||p.cooldown>0)return;
  p.dunkTime=.7;p.charging=0;p.cooldown=1;p.action='dunk';p.actionT=.7;
  g.ball={mode:'dunk',owner:p.id,shooter:p.id,side:p.side,x:p.x,y:p.y,z:25,time:0,duration:.7,blocked:false};
  emit(g,'TAKING FLIGHT!','shot');
}
function steal(g,p){
  if(p.cooldown>0)return;
  p.cooldown=.57;
  const holder=g.ball.mode==='held'?g.players[g.ball.owner]:null;
  if(holder&&holder.side!==p.side&&dist(holder,p)<42){
    const odds=clamp(.17+p.stats.steal*.005-(holder.stats.pass*.0015),.12,.66);
    if(Math.random()<odds){give(g,p,'steal');emit(g,'PICKED CLEAN!','steal')}
  }
}
function jump(g,p){
  if(p.z>0||p.cooldown>0)return;
  p.z=.1;p.vz=188*(.75+p.stats.block/300);p.blockWindow=.43;p.cooldown=.52;p.action='block';p.actionT=.48;
}
function controlKeys(m,g){
  let p=g.players[m.control];
  if(!p||p.side!==m.side)return;
  const key=m.keys||{};
  if(key.switch&&!m.oldSwitch&&g.players.filter(q=>q.side===m.side&&q.ownerToken).length===1){
    const next=g.players.find(q=>q.side===m.side&&q.id!==p.id);
    if(next){m.control=next.id;p=next}
  }
  m.oldSwitch=!!key.switch;
  p.input={up:!!key.up,down:!!key.down,left:!!key.left,right:!!key.right,sprint:!!key.sprint,shoot:!!key.shoot,pass:!!key.pass,jump:!!key.jump};
}
function aiKeys(g,p,dt){
  p.aiThink=Math.max(0,p.aiThink-dt);
  const ball=g.ball,holder=ball.mode==='held'?g.players[ball.owner]:null;
  const attackers=g.players.filter(q=>q.side!==p.side);
  let tx=p.x,ty=p.y;
  if(ball.mode==='loose'||ball.mode==='shot'||ball.mode==='pass'){
    tx=ball.mode==='shot'?goal(ball.side)+rand(-24,24):ball.x;ty=ball.mode==='shot'?RIM_Y:ball.y;
  }else if(holder?.side===p.side){
    if(holder.id===p.id){
      const range=p.stats.three>85?182:58;
      tx=goal(p.side)-dir(p.side)*range;ty=RIM_Y+(p.id%2?36:-34);
      if(p.aiThink===0){
        p.aiThink=rand(.18,.42);
        const d=Math.abs(goal(p.side)-p.x);
        if(d<72&&p.stats.dunk>71&&Math.abs(p.y-RIM_Y)<47)startDunk(g,p);
        else if(d<222&&(d<100||p.stats.three>77))takeShot(g,p,rand(.55,.76));
        else if(attackers.some(q=>dist(p,q)<32))passBall(g,p);
      }
    }else{tx=goal(p.side)-dir(p.side)*(p.stats.three>83?170:75);ty=RIM_Y+(p.id%2?44:-43)}
  }else if(holder){
    const defend=attackers.find(q=>q.id===holder.id)||attackers[0];
    tx=defend.x-dir(p.side)*23;ty=defend.y;
    if(p.aiThink===0){p.aiThink=rand(.3,.65);if(dist(p,holder)<37)steal(g,p);if(holder.dunkTime>0&&dist(p,holder)<52)jump(g,p)}
  }
  p.input={left:tx<p.x-9,right:tx>p.x+9,up:ty<p.y-6,down:ty>p.y+6,sprint:false,shoot:false,pass:false,jump:false};
}
function updatePlayers(room,g,dt){
  for(const p of g.players)p.input={};
  for(const m of room.members.filter(m=>m.connected))controlKeys(m,g);
  for(const p of g.players){
    const owner=room.members.find(m=>m.connected&&m.control===p.id);
    if(!owner)aiKeys(g,p,dt);
    p.cooldown=Math.max(0,p.cooldown-dt);
    p.actionT=Math.max(0,p.actionT-dt);
    p.blockWindow=Math.max(0,p.blockWindow-dt);
    p.stamina=clamp(p.stamina+((p.input.sprint&&p.stamina>0)?-34:18)*dt,0,100);
    const dx=Number(!!p.input.right)-Number(!!p.input.left),dy=Number(!!p.input.down)-Number(!!p.input.up);
    const len=Math.hypot(dx,dy)||1;
    const accel=68+p.stats.speed*.65,boost=p.input.sprint&&p.stamina>2?1.55:1;
    const ax=dx/len*accel*boost,ay=dy/len*accel*boost;
    p.vx+=(ax-p.vx)*Math.min(1,dt*10);p.vy+=(ay-p.vy)*Math.min(1,dt*10);
    // Lock pass direction while the throwing animation completes.
    if((dx||dy)&&!(p.action==='pass'&&p.actionT>0)){
      p.facing8=directionFromVector(dx,dy,p.facing8);
      if(dx)p.face=dx>0?1:-1;
    }
    if(p.dunkTime<=0){p.x=clamp(p.x+p.vx*dt,14,WIDTH-14);p.y=clamp(p.y+p.vy*dt,TOP+8,BOTTOM-8)}
    if(p.z>0||p.vz>0){p.z+=p.vz*dt;p.vz-=420*dt;if(p.z<=0)p.z=p.vz=0}
    const v=p.input,old=p.prev;
    if(v.pass&&!old.pass){if(p.hasBall)passBall(g,p);else steal(g,p)}
    if(v.jump&&!old.jump)jump(g,p);
    if(v.shoot&&p.hasBall)p.charge=clamp(p.charge+dt*.85,0,1.12);
    if(!v.shoot&&old.shoot&&p.hasBall){
      const d=Math.abs(goal(p.side)-p.x);
      if(d<82&&p.stats.dunk>65&&Math.abs(p.y-RIM_Y)<50&&(Math.hypot(p.vx,p.vy)>35||p.z>8))startDunk(g,p);
      else takeShot(g,p,p.charge);
      p.charge=0;
    }
    p.prev={...v};
    if(p.actionT>0)p.anim=p.action;
    else if(p.hasBall&&g.ball.mode==='held')p.anim=Math.hypot(p.vx,p.vy)>18?'dribble':'idle';
    else p.anim=p.z>0?'jump':Math.hypot(p.vx,p.vy)>18?'run':'idle';
  }
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
    const a=g.players[i],b=g.players[j],d=dist(a,b);
    if(d>0&&d<20){const shift=(20-d)*.46;a.x+=(a.x-b.x)/d*shift;a.y+=(a.y-b.y)/d*shift;
      b.x-=(a.x-b.x)/d*shift;b.y-=(a.y-b.y)/d*shift}
  }
}
function updateBall(room,g,dt){
  const b=g.ball;
  if(b.mode==='dead')return;
  if(b.mode==='held'){const p=g.players[b.owner];b.x=p.x+p.face*9;b.y=p.y;b.z=12+p.z;return}
  if(b.mode==='pass'){
    b.time+=dt;const t=clamp(b.time/b.duration,0,1),target=g.players[b.to];
    b.x=b.sx+(target.x-b.sx)*t;b.y=b.sy+(target.y-b.sy)*t;
    b.z=22+Math.sin(Math.PI*t)*39;
    if(t>.18&&t<.94)for(const p of g.players)if(p.side!==b.side&&dist(p,b)<19&&b.z<49){
      give(g,p,'interception');return}
    if(t>=1){give(g,target,'pass');
      const single=room.members.filter(m=>m.side===target.side&&m.connected);
      if(single.length===1)single[0].control=target.id;return}
  }else if(b.mode==='shot'){
    b.time+=dt;const t=clamp(b.time/b.duration,0,1);
    b.x=b.sx+(b.tx-b.sx)*t;b.y=b.sy+(b.ty-b.sy)*t;
    b.z=b.sz+(34-b.sz)*t+Math.sin(Math.PI*t)*125;
    for(const p of g.players)if(p.side!==b.side&&p.blockWindow>0&&p.z>6&&dist(p,b)<31&&Math.abs(p.z+35-b.z)<33){
      b.mode='loose';b.z=Math.max(12,b.z);b.vx=-dir(b.side)*85;b.vy=rand(-50,50);b.vz=85;
      emit(g,'REJECTED!','block');return}
    if(t>=1){if(b.made){score(g,b.side,b.points,b.shooter);return}
      b.mode='loose';b.x=goal(b.side)+rand(-20,20);b.y=RIM_Y+rand(-16,16);
      b.z=36;b.vx=-dir(b.side)*rand(35,100);b.vy=rand(-57,57);b.vz=75;
      emit(g,'OFF THE RIM!','rim');return}
  }else if(b.mode==='dunk'){
    const dunker=g.players[b.shooter];
    b.time+=dt;const t=clamp(b.time/b.duration,0,1);
    const gx=goal(b.side);
    dunker.x+=(gx-dir(b.side)*15-dunker.x)*Math.min(1,dt*7);dunker.y+=(RIM_Y-dunker.y)*Math.min(1,dt*7);
    dunker.z=Math.sin(Math.PI*t)*67;b.x=dunker.x+dir(b.side)*8;b.y=dunker.y;b.z=dunker.z+28;
    if(t>.30&&t<.84)for(const defender of g.players)if(defender.side!==b.side&&defender.blockWindow>0&&dist(defender,dunker)<55){
      const odds=clamp(.17+(defender.stats.block-dunker.stats.dunk)*.007,.09,.57);
      if(Math.random()<odds){dunker.hasBall=false;dunker.z=dunker.dunkTime=0;
        b.mode='loose';b.owner=-1;b.z=54;b.vx=-dir(b.side)*110;b.vy=rand(-50,50);b.vz=80;
        emit(g,'MONSTER BLOCK!','block');return}}
    if(t>=1){dunker.dunkTime=0;dunker.z=0;score(g,b.side,2,b.shooter,true);return}
  }else if(b.mode==='loose'){
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vz-=340*dt;
    if(b.z<7){b.z=7;if(b.vz<0)b.vz=-b.vz*.35;b.vx*=.96;b.vy*=.96}
    b.x=clamp(b.x,14,WIDTH-14);b.y=clamp(b.y,TOP+8,BOTTOM-8);
    if(b.z<38){
      const picks=g.players.filter(p=>dist(p,b)<23&&p.z<23).sort((a,c)=>dist(a,b)-dist(c,b));
      if(picks.length){const candidate=picks[0];
        const shootingSide=b.side;
        give(g,candidate,candidate.side===shootingSide?'rebound':'catch');
        const one=room.members.filter(m=>m.side===candidate.side&&m.connected);
        if(one.length===1)one[0].control=candidate.id}
    }
  }
}
function endPeriod(g){
  if(g.quarter>=4){
    if(g.scores[0]===g.scores[1]){g.overtime=true;g.quarter=5;g.clock=60;resetPossession(g,0);emit(g,'SUDDEN DEATH OVERTIME!','whistle')}
    else{g.phase='OVER';emit(g,'FINAL BUZZER!','whistle')}
  }else {g.phase='BREAK';g.breakClock=4;emit(g,g.quarter===2?'HALFTIME!':'END OF QUARTER!','whistle')}
}
function tick(room,dt=1/30){
  const g=room.game;if(!g||g.phase==='OVER'||g.pause)return;
  g.elapsed+=dt;
  if(g.phase==='BREAK'){g.breakClock-=dt;if(g.breakClock<=0){g.quarter++;g.clock=60;g.phase='PLAY';resetPossession(g,g.quarter%2?0:1)}return}
  if(g.pending>0){g.pending-=dt;if(g.pending<=0)resetPossession(g,g.nextTeam);return}
  g.clock=Math.max(0,g.clock-dt);
  const flight=['shot','dunk'].includes(g.ball.mode);
  if(!flight)g.shotClock=Math.max(0,g.shotClock-dt);
  if(g.shotClock<=0&&!flight){g.pending=.7;g.nextTeam=1-g.possession;g.ball.mode='dead';emit(g,'SHOT CLOCK VIOLATION','whistle');return}
  updatePlayers(room,g,dt);updateBall(room,g,dt);
  if(g.clock<=0&&!['shot','dunk'].includes(g.ball.mode)&&!g.pending)endPeriod(g);
}
function publicGame(g){
  return {teams:g.teams,phase:g.phase,pause:g.pause,quarter:g.quarter,clock:Math.ceil(g.clock),shotClock:Math.ceil(g.shotClock),overtime:g.overtime,
    scores:g.scores,ball:g.ball,players:g.players.map(p=>({id:p.id,side:p.side,profileId:p.spriteId,
      name:p.name,gender:p.gender,hair:p.hair,skin:p.skin,hairStyle:p.hairStyle,stats:p.stats,
      x:p.x,y:p.y,z:p.z,face:p.face,facing8:p.facing8,anim:p.anim,stamina:p.stamina,charge:p.charge,hasBall:p.hasBall,
      blockWindow:p.blockWindow,dunkTime:p.dunkTime,ownerToken:undefined})),
    event:g.events[0]||null,fireId:g.fire.until>g.elapsed?g.fire.id:-1};
}
module.exports={createGame,tick,publicGame,resetPossession,give,passBall,takeShot,score,directionFromVector,WIDTH,TOP,BOTTOM};

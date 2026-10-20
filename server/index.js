'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const {teams,findTeam,findPlayer}=require('./roster');
const {createGame,tick,publicGame}=require('./game');
const PORT=Number(process.env.PORT)||3000;
const ROOT=path.resolve(__dirname,'../public');
const rooms=new Map();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,rooms:rooms.size}))}
  let pathname;
  try{pathname=decodeURIComponent(url.pathname)}catch{return res.writeHead(400).end()}
  if(pathname.includes('\0')||pathname.split('/').some(seg=>seg==='..'||seg.startsWith('.')))return res.writeHead(403).end();
  const local=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
  if(!local.startsWith(ROOT+path.sep))return res.writeHead(403).end();
  fs.stat(local,(err,stat)=>{
    if(err||!stat.isFile())return res.writeHead(404).end('Not found');
    res.writeHead(200,{'Content-Type':mime[path.extname(local)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(local).pipe(res);
  });
});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096,perMessageDeflate:false});
function send(ws,data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))}
function membersSide(room,side){return room.members.filter(m=>m.side===side)}
function roomSummary(room,m){
  const sideMembers=membersSide(room,m.side);
  const myTeam=room.sides[m.side].teamId;
  return {t:'room',code:room.code,phase:room.phase,mode:room.mode,solo:room.solo,
    isHost:room.host===m.id,me:m.id,mySide:m.side,members:room.members.map(p=>({id:p.id,initials:p.initials,side:p.side,connected:p.connected,ready:p.ready})),
    roster:teams,myTeam,ownPicks:sideMembers.map(p=>({id:p.id,initials:p.initials,pick:p.pick,support:p.support,ready:p.ready})),
    otherTeamReady:room.members.filter(p=>p.side!==m.side&&p.ready).length,
    control:m.control,error:null};
}
function broadcast(room){for(const m of room.members)if(m.connected)send(m.ws,roomSummary(room,m))}
function error(ws,message){send(ws,{t:'error',message})}
function emptyRoom(solo=false){
  let code;do{code=crypto.randomBytes(4).toString('hex').toUpperCase()}while(rooms.has(code));
  const room={code,phase:'lobby',mode:'random',solo,host:null,members:[],sides:[{teamId:null},{teamId:null}],
    game:null,created:Date.now(),lastActive:Date.now()};
  rooms.set(code,room);return room;
}
function enterRoom(ws,room,token){
  const existing=token&&room.members.find(p=>p.token===token);
  if(existing){
    if(existing.connected&&existing.ws!==ws)existing.ws?.close(4000,'Session moved');
    existing.ws=ws;existing.connected=true;ws.member=existing;ws.room=room;
    send(ws,{t:'joined',code:room.code,token:existing.token,me:existing.id});
    broadcast(room);return;
  }
  if(room.phase!=='lobby'||room.members.length>=4){error(ws,'Lobby is closed or full.');return}
  const m={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),initials:'',side:0,connected:true,
    ws,keys:{},oldSwitch:false,ready:false,pick:null,support:null,control:-1,rate:0,rateSince:Date.now()};
  room.members.push(m);ws.member=m;ws.room=room;
  if(room.members.length===1){room.host=m.id;room.sides[1].teamId=teams[1].id}
  else if(room.mode==='random')m.side=room.members.length===2?1:(room.members.length===3?0:1);
  else m.side=membersSide(room,0).length>2?1:0;
  send(ws,{t:'joined',code:room.code,token:m.token,me:m.id});broadcast(room);maybeFull(room);
}
function sidesValid(room){
  const left=membersSide(room,0).length,right=membersSide(room,1).length;
  return left>=1&&left<=2&&right>=1&&right<=2;
}
function arrangeRandom(room){
  const list=[...room.members].sort(()=>Math.random()-.5);
  list.forEach((m,i)=>{m.side=i%2});
  if(room.members.length===3){list[2].side=0}
}
function beginDraft(room){
  if(room.phase!=='lobby')return;
  if(room.members.length<2&&!room.solo)return;
  if(room.members.some(m=>!/^[A-Z]{3}$/.test(m.initials)))return;
  if(room.solo){room.members[0].side=0;room.sides[1].teamId=teams[Math.floor(Math.random()*(teams.length-1))+1].id}
  else if(room.mode==='random')arrangeRandom(room);
  if(!room.solo&&!sidesValid(room))return;
  room.phase='draft';
  room.sides[0].teamId=null;
  if(!room.solo)room.sides[1].teamId=null;
  room.members.forEach(m=>{m.ready=false;m.pick=null;m.support=null;m.keys={}});
  broadcast(room);
}
function maybeFull(room){if(room.phase==='lobby'&&room.members.length===4&&room.members.every(m=>m.initials))beginDraft(room)}
function chooseTeam(room,m,id){
  if(room.phase!=='draft')return;
  const group=membersSide(room,m.side);
  if(group[0]!==m){error(m.ws,'Your teammate is the team captain.');return}
  if(!findTeam(id)){error(m.ws,'Unknown team.');return}
  if(room.sides[m.side].teamId!==id){
    room.sides[m.side].teamId=id;
    group.forEach(member=>{member.pick=null;member.support=null;member.ready=false});
  }
  broadcast(room);
}
function validPick(room,m,pick,support){
  const teamId=room.sides[m.side].teamId;
  if(!teamId||!findPlayer(teamId,pick))return false;
  const group=membersSide(room,m.side);
  if(group.length===1)return !!support&&pick!==support&&!!findPlayer(teamId,support);
  return !group.some(other=>other!==m&&other.pick===pick);
}
function maybeStart(room){
  if(room.phase!=='draft'||!room.members.every(m=>m.ready))return;
  if(!room.sides[0].teamId||!room.sides[1].teamId)return;
  try{room.game=createGame(room)}catch(err){room.members.forEach(m=>error(m.ws,'Draft error: '+err.message));return}
  room.phase='game';broadcast(room);
}
function handle(ws,data){
  const m=ws.member,room=ws.room;
  if(data.t==='create'&&!m){const newRoom=emptyRoom(false);enterRoom(ws,newRoom);return}
  if(data.t==='solo'&&!m){const newRoom=emptyRoom(true);enterRoom(ws,newRoom);return}
  if(data.t==='join'&&!m){
    const code=String(data.code||'').toUpperCase();
    if(!/^[A-F0-9]{8}$/.test(code)||!rooms.has(code)){error(ws,'Lobby not found. Ask the host to start Codespaces.');return}
    enterRoom(ws,rooms.get(code),typeof data.token==='string'?data.token:null);return;
  }
  if(!m||!room){error(ws,'Create or join a lobby first.');return}
  room.lastActive=Date.now();
  if(data.t==='initials'&&room.phase==='lobby'){
    const initials=String(data.value||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
    if(initials.length!==3){error(ws,'Enter exactly three letters.');return}
    if(room.members.some(p=>p!==m&&p.initials===initials)){error(ws,'Those initials are taken.');return}
    m.initials=initials;broadcast(room);if(room.solo)beginDraft(room);else maybeFull(room);return;
  }
  if(data.t==='mode'&&room.phase==='lobby'&&room.host===m.id){
    if(['random','assigned'].includes(data.mode)){room.mode=data.mode;broadcast(room)}return;
  }
  if(data.t==='assign'&&room.phase==='lobby'&&room.host===m.id&&room.mode==='assigned'){
    const target=room.members.find(p=>p.id===data.id),side=Number(data.side);
    if(!target||![0,1].includes(side))return;
    if(target.side!==side&&membersSide(room,side).length>=2){error(ws,'Only two players per team.');return}
    target.side=side;broadcast(room);return;
  }
  if(data.t==='advance'&&room.phase==='lobby'&&room.host===m.id){
    if(room.members.length<2&&!room.solo){error(ws,'Need at least two people.');return}
    if(room.members.some(p=>!p.initials)){error(ws,'Everyone must enter three initials.');return}
    if(room.mode==='assigned'&&!sidesValid(room)){error(ws,'Assign one or two players to each team.');return}
    beginDraft(room);return;
  }
  if(data.t==='team'){chooseTeam(room,m,String(data.id||''));return}
  if(data.t==='pick'&&room.phase==='draft'){
    if(!validPick(room,m,data.pick,data.support)){error(ws,'Select eligible, different players from your team.');return}
    m.pick=data.pick;m.support=membersSide(room,m.side).length===1?data.support:null;m.ready=false;
    broadcast(room);return;
  }
  if(data.t==='ready'&&room.phase==='draft'){
    if(!validPick(room,m,m.pick,m.support)){error(ws,'Choose your player(s) first.');return}
    m.ready=!!data.value;broadcast(room);maybeStart(room);return;
  }
  if(data.t==='input'&&room.phase==='game'){
    const fields=['up','down','left','right','pass','shoot','jump','sprint','switch'];
    m.keys=Object.fromEntries(fields.map(k=>[k,data.keys?.[k]===true]));
    return;
  }
  if(data.t==='rematch'&&room.phase==='game'&&room.host===m.id&&room.game?.phase==='OVER'){
    room.phase='draft';room.game=null;room.sides[0].teamId=null;
    if(!room.solo)room.sides[1].teamId=null;
    room.members.forEach(player=>{player.pick=null;player.support=null;player.ready=false;player.control=-1;player.keys={}});
    broadcast(room);return;
  }
  if(data.t==='pause'&&room.phase==='game'&&room.host===m.id){
    room.game.pause=!room.game.pause;broadcast(room);
  }
}
wss.on('connection',ws=>{
  ws.on('message',buf=>{
    const now=Date.now();
    const m=ws.member;if(m){if(now-m.rateSince>1000){m.rateSince=now;m.rate=0}if(++m.rate>90){ws.close(1008,'Rate exceeded');return}}
    let msg;try{msg=JSON.parse(buf.toString())}catch{return error(ws,'Invalid message')}
    if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return;
    try{handle(ws,msg)}catch(err){console.error('Message error:',err);error(ws,'Could not process request')}
  });
  ws.on('close',()=>{
    const m=ws.member,r=ws.room;
    if(!m||!r||m.ws!==ws)return;
    m.connected=false;m.keys={};
    if(r.phase==='lobby'||r.phase==='draft'){
      r.members=r.members.filter(p=>p!==m);
      if(r.host===m.id)r.host=r.members[0]?.id||null;
      if(r.phase==='draft'){r.phase='lobby';r.sides=[{teamId:null},{teamId:null}];r.members.forEach(p=>{p.ready=false;p.pick=null;p.support=null})}
      if(!r.members.length){rooms.delete(r.code);return}
    }else if(r.host===m.id)r.host=r.members.find(p=>p.connected)?.id||m.id;
    broadcast(r);
  });
});
let frame=0;
setInterval(()=>{
  frame++;
  for(const room of rooms.values()){
    if(room.phase==='game'){tick(room,1/30);
      if(frame%2===0){const game=publicGame(room.game);
        game.controllers=room.members.filter(member=>member.connected).map(member=>({slot:member.control,initials:member.initials}));
        for(const m of room.members)if(m.connected)send(m.ws,{t:'game',game,control:m.control,host:room.host===m.id})}}
    if(Date.now()-room.lastActive>3*60*60*1000){rooms.delete(room.code);for(const m of room.members)m.ws?.close(1001,'Expired')}
  }
},1000/30);
server.listen(PORT,'0.0.0.0',()=>console.log('BOOMSHAKALAKA ready on http://localhost:'+PORT));
module.exports={server,rooms,emptyRoom,beginDraft,sidesValid};

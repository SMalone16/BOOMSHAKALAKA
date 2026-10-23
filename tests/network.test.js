'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createServer}=require('node:net');
const WebSocket=require('ws');
const {teams}=require('../server/roster');
function freePort(){return new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))})})}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class Browser {
  constructor(ws){this.ws=ws;this.queue=[];this.waiters=[];
    ws.on('message',buf=>{const data=JSON.parse(String(buf));this.queue.push(data);
      for(const w of [...this.waiters])if(w.predicate(data)){clearTimeout(w.timer);this.waiters.splice(this.waiters.indexOf(w),1);w.resolve(data)}})}
  async receive(predicate,timeout=5000){
    const prior=this.queue.find(predicate);if(prior)return prior;
    return new Promise((resolve,reject)=>{
      const w={predicate,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(q=>q!==w);reject(Error('Timed out waiting for server message'))},timeout)};
      this.waiters.push(w);
    });
  }
  send(value){this.ws.send(JSON.stringify(value))}
  close(){this.ws.close()}
}
async function connect(port){
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});
  return new Browser(ws);
}
async function serverForTest(){
  const port=await freePort();
  const child=spawn(process.execPath,['server/index.js'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'pipe'});
  let error='';child.stderr.on('data',b=>{error+=b.toString()});
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error('Server stopped unexpectedly: '+error);
    try{const response=await fetch('http://127.0.0.1:'+port+'/health');if(response.ok)return {port,child}}catch{}
    await wait(40);
  }
  child.kill();throw Error('Server failed to start: '+error);
}
test('two browser connections can create/join a private lobby, draft, and play', {timeout:15000},async()=>{
  const {port,child}=await serverForTest();let host,guest;
  try{
    host=await connect(port);host.send({t:'create'});
    const joined=await host.receive(d=>d.t==='joined');
    assert.match(joined.code,/^[A-F0-9]{8}$/);
    host.send({t:'initials',value:'AAA'});
    guest=await connect(port);guest.send({t:'join',code:joined.code});
    const guestJoin=await guest.receive(d=>d.t==='joined');
    assert.equal(guestJoin.code,joined.code);
    guest.send({t:'initials',value:'BBB'});
    await host.receive(d=>d.t==='room'&&d.phase==='lobby'&&d.members.length===2&&d.members.every(m=>m.initials));
    host.send({t:'advance'});
    const draftHost=await host.receive(d=>d.t==='room'&&d.phase==='draft');
    const draftGuest=await guest.receive(d=>d.t==='room'&&d.phase==='draft');
    assert.notEqual(draftHost.mySide,draftGuest.mySide);
    assert.ok(!('opponentTeam' in draftHost),"Opponent team choice must remain hidden");
    host.send({t:'team',id:teams[0].id});
    guest.send({t:'team',id:teams[1].id});
    await host.receive(d=>d.t==='room'&&d.phase==='draft'&&d.myTeam===teams[0].id);
    await guest.receive(d=>d.t==='room'&&d.phase==='draft'&&d.myTeam===teams[1].id);
    host.send({t:'pick',pick:teams[0].players[0].id,support:teams[0].players[1].id});
    guest.send({t:'pick',pick:teams[1].players[0].id,support:teams[1].players[1].id});
    host.send({t:'ready',value:true});guest.send({t:'ready',value:true});
    await host.receive(d=>d.t==='room'&&d.phase==='game');
    const snapshot=await host.receive(d=>d.t==='game'&&d.game?.players.length===4);
    assert.equal(snapshot.game.controllers.length,2);
    assert.deepEqual([...snapshot.game.teams].sort(),[teams[0].id,teams[1].id].sort());
    assert.equal(snapshot.game.players.length,4);
  }finally{host?.close();guest?.close();child.kill('SIGTERM')}
});
test('solo player can choose two teammates and enter a CPU match', {timeout:15000},async()=>{
  const {port,child}=await serverForTest();let host;
  try{
    host=await connect(port);host.send({t:'solo'});
    await host.receive(d=>d.t==='joined');
    const initialDraft=await host.receive(d=>d.t==='room'&&d.phase==='draft');
    assert.equal(initialDraft.solo,true);
    assert.equal(initialDraft.members[0].initials,'YOU','solo skips lobby/initials');
    assert.equal(initialDraft.soloOpponent,teams[1].id);
    // The solo player may freely choose any opponent, including teams whose
    // updated animation sheets they want to playtest.
    host.send({t:'opponent-team',id:teams[0].id});
    await host.receive(d=>d.t==='room'&&d.phase==='draft'&&d.soloOpponent===teams[0].id);
    host.send({t:'team',id:teams[2].id});
    await host.receive(d=>d.t==='room'&&d.phase==='draft'&&d.myTeam===teams[2].id);
    host.send({t:'pick',pick:teams[2].players[0].id,support:teams[2].players[1].id});
    host.send({t:'ready',value:true});
    await host.receive(d=>d.t==='room'&&d.phase==='game');
    const snap=await host.receive(d=>d.t==='game'&&d.game?.players.length===4);
    assert.equal(snap.game.controllers.length,1);
    assert.equal(snap.game.teams[0],teams[2].id);
    assert.equal(snap.game.teams[1],teams[0].id);
  }finally{host?.close();child.kill('SIGTERM')}
});

test('four browsers automatically enter private draft then play as two teams', {timeout:18000},async()=>{
  const {port,child}=await serverForTest();const clients=[];
  try{
    const host=await connect(port);clients.push(host);host.send({t:'create'});
    const first=await host.receive(d=>d.t==='joined');
    const code=first.code;host.send({t:'initials',value:'AAA'});
    for(let i=1;i<4;i++){
      const visitor=await connect(port);clients.push(visitor);
      visitor.send({t:'join',code});
      await visitor.receive(d=>d.t==='joined');
      visitor.send({t:'initials',value:['AAA','BBB','CCC','DDD'][i]});
    }
    const summaries=await Promise.all(clients.map(c=>c.receive(d=>d.t==='room'&&d.phase==='draft')));
    assert.equal(new Set(summaries.map(s=>s.me)).size,4);
    assert.equal(summaries.filter(s=>s.mySide===0).length,2);
    assert.equal(summaries.filter(s=>s.mySide===1).length,2);
    for(const side of [0,1]){
      const captainIndex=summaries.findIndex(s=>s.mySide===side&&s.ownPicks[0].id===s.me);
      assert.ok(captainIndex>=0);
      clients[captainIndex].send({t:'team',id:teams[side].id});
    }
    await Promise.all(clients.map((c,i)=>c.receive(d=>d.t==='room'&&d.phase==='draft'&&d.myTeam===teams[summaries[i].mySide].id)));
    for(let i=0;i<4;i++){
      const s=summaries[i],side=s.mySide,idx=s.ownPicks.findIndex(p=>p.id===s.me);
      clients[i].send({t:'pick',pick:teams[side].players[idx].id});
    }
    for(const c of clients)c.send({t:'ready',value:true});
    const start=await host.receive(d=>d.t==='game'&&d.game?.controllers.length===4);
    assert.equal(start.game.players.length,4);
    assert.deepEqual(start.game.controllers.map(p=>p.initials).sort(),['AAA','BBB','CCC','DDD']);
  }finally{clients.forEach(c=>c.close());child.kill('SIGTERM')}
});

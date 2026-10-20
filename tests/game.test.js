'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {teams}=require('../server/roster');
const {createGame,tick,passBall,takeShot,give,score}=require('../server/game');
function buildRoom(mode='duo'){
  const member={id:'human-1',token:'t1',side:0,pick:teams[0].players[0].id,
    support:teams[0].players[1].id,connected:true,keys:{},oldSwitch:false};
  const second={id:'human-2',token:'t2',side:1,pick:teams[1].players[0].id,
    support:teams[1].players[1].id,connected:true,keys:{},oldSwitch:false};
  return {members:mode==='solo'?[member]:[member,second],
    sides:[{teamId:teams[0].id},{teamId:teams[1].id}],solo:mode==='solo'};
}
test('all seven teams provide four distinct athletes and at least one female',()=>{
  assert.equal(teams.length,7);
  const rosterIds=new Set();
  for(const t of teams){
    assert.equal(t.players.length,4,t.name);
    assert.ok(t.players.some(p=>p.gender==='F'),t.name);
    for(const p of t.players){
      assert.ok(!rosterIds.has(p.id),p.id);rosterIds.add(p.id);
      assert.equal(Object.keys(p.stats).length,6);
      for(const v of Object.values(p.stats))assert.ok(v>=0&&v<=100,p.name);
    }
  }
  assert.equal(rosterIds.size,28);
});
test('solo game fields one human-controlled athlete and three CPU athletes',()=>{
  const room=buildRoom('solo'),g=createGame(room);room.game=g;
  assert.equal(g.players.length,4);
  assert.equal(g.players.filter(p=>p.ownerToken!==null).length,1);
  assert.equal(g.players[0].hasBall,true);
  for(let i=0;i<90;i++)tick(room);
  assert.ok(g.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('duo game is 2 vs 2 with legal team profiles',()=>{
  const room=buildRoom(),g=createGame(room);
  assert.deepEqual(g.players.map(p=>p.side),[0,0,1,1]);
  assert.equal(g.players.filter(p=>p.ownerToken!==null).length,2);
});
test('a teammate catch never resets the shot clock',()=>{
  const room=buildRoom('solo'),g=createGame(room);room.game=g;g.shotClock=5;
  const receiver=g.players[1];give(g,receiver,'pass');
  assert.equal(g.shotClock,5);
  assert.equal(g.possession,0);
});
test('a true turnover resets shot clock to 24',()=>{
  const room=buildRoom(),g=createGame(room);g.shotClock=3;
  give(g,g.players[2],'interception');
  assert.equal(g.shotClock,24);
  assert.equal(g.possession,1);
});
test('offensive rebound is 14 seconds, defensive rebound 24',()=>{
  const room=buildRoom(),g=createGame(room);g.shotClock=2;
  give(g,g.players[1],'rebound');assert.equal(g.shotClock,14);
  give(g,g.players[2],'rebound');assert.equal(g.shotClock,24);
});
test('pass makes a traveling ball and excludes same-frame self-catch',()=>{
  const room=buildRoom('solo'),g=createGame(room);room.game=g;
  passBall(g,g.players[0]);
  assert.equal(g.ball.mode,'pass');
  assert.equal(g.ball.from,0);assert.equal(g.ball.to,1);
  tick(room);
  assert.notEqual(g.ball.owner,0);
});
test('shot that is already airborne survives expired shot clock',()=>{
  const room=buildRoom('solo'),g=createGame(room);room.game=g;
  g.shotClock=.01;takeShot(g,g.players[0],.65);
  assert.equal(g.ball.mode,'shot');
  for(let i=0;i<8;i++)tick(room);
  assert.notEqual(g.events[0]?.text,'SHOT CLOCK VIOLATION');
  assert.equal(g.ball.mode,'shot');
});
test('quarter four tie starts sudden-death overtime',()=>{
  const room=buildRoom('solo'),g=createGame(room);room.game=g;
  g.quarter=4;g.clock=.01;g.scores=[6,6];tick(room);
  assert.equal(g.overtime,true);assert.equal(g.quarter,5);assert.equal(g.phase,'PLAY');
});
test('first sudden-death bucket ends match without double-scoring',()=>{
  const room=buildRoom('solo'),g=createGame(room);
  g.overtime=true;g.quarter=5;
  score(g,0,2,0);assert.equal(g.phase,'OVER');assert.deepEqual(g.scores,[2,0]);
  score(g,0,2,0);assert.deepEqual(g.scores,[2,0]);
});

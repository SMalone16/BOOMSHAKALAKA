'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const SpriteArt=require('../public/sprites');
const {teams}=require('../server/roster');
const {createGame,publicGame}=require('../server/game');

const roster=[teams[0],teams[1]].flatMap(t=>t.players);
test('all eight uploaded sprite sheets map to existing Pallet and Pewter roster IDs',()=>{
  assert.equal(Object.keys(SpriteArt.characters).length,8);
  for(const player of roster){
    const file=SpriteArt.characters[player.id];
    assert.ok(file,'missing manifest for '+player.id);
    const resolved=path.resolve(__dirname,'../public/assets/sprites',file);
    assert.ok(fs.existsSync(resolved),'missing file '+file);
    const data=fs.readFileSync(resolved);
    assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a',file);
    assert.equal(data.readUInt32BE(16),1086,file);
    assert.equal(data.readUInt32BE(20),1448,file);
    assert.equal(data[25],6,'expected RGBA PNG '+file);
    assert.ok(SpriteArt.filePath(player.id).includes(encodeURIComponent(path.basename(file))));
  }
});
test('nine pose cells have predictable indices and no cropped-out frame',()=>{
  assert.deepEqual(SpriteArt.cells,['idle','run-a','run-b','dribble','pass','shoot','block','dunk','celebrate']);
  for(let i=0;i<9;i++){
    const b=SpriteArt.sourceRect(1086,1448,i);
    assert.ok(b.sx>=0&&b.sy>=0);
    assert.ok(b.sx+b.sw<=1086+1e-6);
    assert.ok(b.sy+b.sh<=1448+1e-6);
    assert.ok(Math.abs(b.sw/b.sh-.75)<.001);
  }
  assert.equal(SpriteArt.frameFor('idle'),0);
  assert.equal(SpriteArt.frameFor('pass'),4);
  assert.equal(SpriteArt.frameFor('shoot'),5);
  assert.equal(SpriteArt.frameFor('block'),6);
  assert.equal(SpriteArt.frameFor('dunk'),7);
  assert.equal(SpriteArt.frameFor('celebrate'),8);
  assert.equal(SpriteArt.frameFor('run',0,0),1);
  assert.equal(SpriteArt.frameFor('run',.2,0),2);
});
test('server broadcasts stable roster sprite IDs, separate from transient court slot IDs',()=>{
  const room={solo:true,sides:[{teamId:teams[0].id},{teamId:teams[1].id}],
    members:[{id:'a',token:'player-a',side:0,pick:teams[0].players[0].id,
      support:teams[0].players[1].id,connected:true,keys:{}}]};
  const game=createGame(room);const snap=publicGame(game);
  assert.equal(snap.players.length,4);
  assert.deepEqual(snap.players.map(p=>p.profileId),[
    teams[0].players[0].id,teams[0].players[1].id,teams[1].players[0].id,teams[1].players[1].id
  ]);
  assert.deepEqual(snap.players.map(p=>p.id),[0,1,2,3]);
});
test('sprite manager draws selected source cell without interpolating and returns fallback for unknown teams',()=>{
  const originalImage=global.Image;
  class MockImage{
    naturalWidth=1086;naturalHeight=1448;
    set src(value){this._src=value;this.onload?.()}
  }
  const calls=[],c={
    imageSmoothingEnabled:true,
    save(){calls.push('save')},restore(){calls.push('restore')},
    translate(x,y){calls.push(['translate',x,y])},scale(x,y){calls.push(['scale',x,y])},
    drawImage(...args){calls.push(['drawImage',...args])}
  };
  global.Image=MockImage;
  try{
    const p={profileId:'pallet-0',id:0,face:-1};
    assert.equal(SpriteArt.draw(c,p,123,150,1.25,0,'dunk',{face:-1}),true);
    const cmd=calls.find(entry=>Array.isArray(entry)&&entry[0]==='drawImage');
    assert.ok(cmd);assert.ok(cmd[2]>=0);assert.ok(cmd[3]>=0);
    assert.ok(cmd[4]>0);assert.ok(cmd[5]>0);
    assert.equal(cmd[8],48*1.25);
    assert.equal(cmd[9],64*1.25);
    assert.ok(calls.some(entry=>Array.isArray(entry)&&entry[0]==='scale'&&entry[1]===-1));
    assert.equal(SpriteArt.draw(c,{profileId:'lavender-0'},30,90,1,0,'idle'),false);
  }finally{global.Image=originalImage}
});

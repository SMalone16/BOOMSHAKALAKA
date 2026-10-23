'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const SpriteArt=require('../public/sprites');
const {teams}=require('../server/roster');
const {createGame,publicGame}=require('../server/game');

const roster=[teams[0],teams[1]].flatMap(t=>t.players);
test('all 8 athlete IDs resolve to normalized, existing 7x10 atlases',()=>{
 assert.equal(roster.length,8);
 assert.equal(Object.keys(SpriteArt.directional).length,8);
 assert.equal(Object.keys(SpriteArt.characters).length,0,'removed old nine-pose PNGs must not be loaded');
 for(const player of roster){
   const name=SpriteArt.directional[player.id];
   assert.ok(name,'unmapped athlete '+player.id);
   assert.match(name,/^(pallet|pewter)\/[a-z]+\.png$/);
   const file=path.resolve(__dirname,'../public/assets/sprites',name);
   assert.ok(fs.existsSync(file),'missing PNG '+name);
   const data=fs.readFileSync(file);
   assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');
   const w=data.readUInt32BE(16),h=data.readUInt32BE(20);
   assert.ok(w>=1000&&h>=800,'unexpectedly small frame atlas '+name);
   assert.ok(Math.abs(w/h-1.25)<.04,'non 7x10-style aspect ratio '+name);
   assert.equal(data[25],6,'RGBA PNG expected '+name);
   assert.equal(SpriteArt.advancedPath(player.id),'/assets/sprites/'+name);
   assert.ok(!fs.existsSync(file+'.png'),'old doubled extension should be absent');
 }
});
test('legacy crop metadata remains supported without requiring absent artwork',()=>{
 assert.equal(SpriteArt.cols,3);assert.equal(SpriteArt.rows,3);
 assert.equal(SpriteArt.frameFor('shoot'),5);
 assert.equal(SpriteArt.frameFor('block'),6);
 assert.equal(SpriteArt.frameFor('dunk'),7);
 const cell=SpriteArt.sourceRect(1086,1448,8);
 assert.ok(cell.sx>=0&&cell.sy>=0&&cell.sw>0&&cell.sh>0);
});
test('server snapshots preserve stable roster sprite IDs instead of court slot IDs',()=>{
 const room={solo:true,sides:[{teamId:teams[0].id},{teamId:teams[1].id}],
   members:[{id:'a',token:'player-a',side:0,pick:teams[0].players[0].id,
     support:teams[0].players[3].id,connected:true,keys:{}}]};
 const g=publicGame(createGame(room));
 assert.equal(g.players.length,4);
 assert.deepEqual(g.players.map(p=>p.profileId),
   [teams[0].players[0].id,teams[0].players[3].id,teams[1].players[0].id,teams[1].players[1].id]);
 assert.deepEqual(g.players.map(p=>p.id),[0,1,2,3]);
});
test('sprite manager draws Pewter and Pallet characters through advanced atlas',()=>{
 const originalImage=global.Image;
 class MockImage{
  naturalWidth=1402;naturalHeight=1122;
  set src(v){this.path=v;this.onload?.()}
 }
 const calls=[];
 const c={save(){},restore(){},translate(){},scale(...v){calls.push(['scale',...v])},
   drawImage(...v){calls.push(['drawImage',...v])}};
 global.Image=MockImage;
 try{
   for(const id of ['pallet-1','pallet-2','pewter-0','pewter-1','pewter-2','pewter-3']){
     calls.length=0;
     assert.equal(SpriteArt.draw(c,{profileId:id,facing8:3},120,170,1,0,'run',{animTime:.25,direction:3}),true,id);
     assert.equal(calls.filter(v=>v[0]==='drawImage').length,1,id);
     assert.equal(calls.find(v=>v[0]==='drawImage')[1].path,SpriteArt.advancedPath(id));
   }
   assert.equal(SpriteArt.draw(c,{profileId:'lavender-0'},50,80,1,0,'idle'),false);
 }finally{global.Image=originalImage}
});

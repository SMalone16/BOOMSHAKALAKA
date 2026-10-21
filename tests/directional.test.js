'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const art=require('../public/sprites');
const {teams}=require('../server/roster');
const {createGame,passBall,tick,publicGame,directionFromVector}=require('../server/game');

test('both new 70-frame assets are mapped by exact double-extension filenames',()=>{
  assert.deepEqual(Object.keys(art.directional).sort(),['pallet-0','pallet-3']);
  assert.equal(art.advancedPath('pallet-0'),'/assets/sprites/pallet/ash.png.png');
  assert.equal(art.advancedPath('pallet-3'),'/assets/sprites/pallet/leaf.png.png');
  for(const id of ['pallet-0','pallet-3']){
    const name=art.directional[id];
    const file=fs.readFileSync(path.resolve(__dirname,'../public/assets/sprites',name));
    assert.equal(file.toString('hex',0,8),'89504e470d0a1a0a');
    const w=file.readUInt32BE(16),h=file.readUInt32BE(20);
    assert.ok(w>=1000&&h>=800,'asset seems too small to hold an 80-cell atlas');
    assert.equal(file[25],6,'required RGBA for transparent backgrounds');
    for(let row=0;row<7;row++)for(let col=0;col<10;col++){
      const r=art.advancedRect(w,h,row,col);
      assert.ok(r.sx>=0&&r.sy>=0);
      assert.ok(r.sx+r.sw<=w+1e-6);
      assert.ok(r.sy+r.sh<=h+1e-6);
      assert.ok(r.sw>0&&r.sh>0);
    }
  }
});
test('eight-way movement maps onto seven painted rows and mirrors missing West',()=>{
  const vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  assert.deepEqual(vectors.map(v=>directionFromVector(...v)),[0,1,2,3,4,5,6,7]);
  assert.deepEqual(vectors.map(v=>art.directionFromVector(...v)),[0,1,2,3,4,5,6,7]);
  assert.equal(directionFromVector(0,0,3),3);
  assert.deepEqual(art.directions,['N','NE','E','SE','S','SW','W','NW']);
  assert.equal(art.ADV_ROWS,7);
  assert.equal(art.ADV_COLS,10);
  assert.deepEqual(art.advancedDirections.map(x=>x.row),[0,1,2,3,4,5,2,6]);
  assert.deepEqual(art.advancedDirections.map(x=>x.flipX),[false,false,false,false,false,false,true,false]);
  const e=art.advancedRect(1402,1122,2,0),w=art.advancedRect(1402,1122,6,0);
  assert.equal(e.sy,w.sy);
  assert.equal(w.flipX,true);
  assert.equal(art.advancedRect(1402,1122,7,9).sy,1122/7*6);
});
test('movement cycles through four running frames and two dribble frames',()=>{
  assert.deepEqual([0,.115,.23,.345,.46].map(x=>art.advancedFrameFor('run',x)),[2,3,4,5,2]);
  assert.deepEqual([0,.16,.32].map(x=>art.advancedFrameFor('dribble',x)),[6,7,6]);
  assert.deepEqual([0,.55,1.10].map(x=>art.advancedFrameFor('idle',x)),[0,1,0]);
  assert.deepEqual([0,.139,.14,.45].map(x=>art.advancedFrameFor('pass',x)),[8,8,9,9]);
});
test('advanced renderer chooses source row, preserves sizing and mirrors only missing West',()=>{
  const old=global.Image;const calls=[];
  class ImageMock{naturalWidth=1402;naturalHeight=1122;set src(v){this.path=v;this.onload?.()}}
  const c={save(){},restore(){},translate(){},scale(...x){calls.push(['scale',...x])},drawImage(...args){calls.push(['drawImage',...args])}};
  global.Image=ImageMock;
  try{
    const p={profileId:'pallet-0',face:-1,facing8:5};
    assert.equal(art.draw(c,p,100,200,1,22,'pass',{direction:5,animTime:.2}),true);
    const cmd=calls.find(x=>x[0]==='drawImage');
    assert.ok(cmd);const expected=art.advancedRect(1402,1122,5,9);
    assert.equal(cmd[2],expected.sx);assert.equal(cmd[3],expected.sy);
    assert.equal(cmd[4],expected.sw);assert.equal(cmd[5],expected.sh);
    assert.ok(!calls.some(x=>x[0]==='scale'),'Southwest art must not be mirrored');
    calls.length=0;
    assert.equal(art.draw(c,{profileId:'pallet-0',facing8:6},100,200,1,0,'run',{direction:6,animTime:0}),true);
    assert.ok(calls.some(x=>x[0]==='scale'&&x[1]===-1&&x[2]===1),'West must mirror the east row');
    assert.ok(Math.abs(cmd[8]/cmd[9]-expected.sw/expected.sh)<.001,'avoid distorting square atlas cells');
  }finally{global.Image=old}
});
test('new art preserves old nine-frame fallback for shooting and dunking',()=>{
  const old=global.Image;const calls=[];
  class ImageMock{naturalWidth=1086;naturalHeight=1448;set src(v){this.path=v;this.onload?.()}}
  const c={save(){},restore(){},translate(){},scale(){},drawImage(...args){calls.push(args)}};
  global.Image=ImageMock;
  try{
    assert.equal(art.draw(c,{profileId:'pallet-3',face:1},10,40,1,0,'shoot'),true);
    assert.equal(calls[0][0].path,'/assets/sprites/pallet/Pallet%20-%20Leaf.png');
    assert.equal(calls[0][1],art.sourceRect(1086,1448,5).sx);
  }finally{global.Image=old}
});
test('server chooses pass direction toward receiver and locks it through windup',()=>{
  const room={solo:true,members:[{id:'human',token:'p',side:0,pick:teams[0].players[0].id,
    support:teams[0].players[3].id,connected:true,keys:{left:true},oldSwitch:false}],
    sides:[{teamId:teams[0].id},{teamId:teams[1].id}]};
  const g=createGame(room);room.game=g;
  const p=g.players[0],mate=g.players[1];
  mate.x=p.x-40;mate.y=p.y-50;
  passBall(g,p);
  assert.equal(p.facing8,7,'passer should face NW teammate');
  assert.equal(p.face,-1,'legacy animations must also face receiver');
  assert.equal(g.ball.mode,'pass');
  for(let i=0;i<3;i++)tick(room);
  assert.equal(p.facing8,7,'pass facing should remain locked during action');
  assert.equal(publicGame(g).players[0].facing8,7,'direction must be sent to clients');
});

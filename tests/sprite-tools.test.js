'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {bounds,sourceFor}=require('../scripts/sprite-tools.cjs');
const SpriteArt=require('../public/sprites');

test('Sharp extraction coordinates match in-game Canvas cropping for every 7x10 cell',()=>{
  const w=1402,h=1122;
  for(let row=0;row<7;row++)for(let col=0;col<10;col++){
    const a=bounds(w,h,row,col);
    const direction=SpriteArt.advancedDirections.findIndex(v=>v.row===row&&!v.flipX);
    assert.ok(direction>=0);
    const b=SpriteArt.advancedRect(w,h,direction,col);
    assert.deepEqual([b.sx,b.sy,b.sw,b.sh],[a.left,a.top,a.width,a.height]);
  }
});

test('Sharp can extract a legal final frame from all eight uploaded atlases',async()=>{
  for(const id of Object.keys(SpriteArt.directional)){
    const source=sourceFor(id),meta=await sharp(source).metadata();
    assert.equal(meta.format,'png',id);
    assert.ok(meta.width>=1000&&meta.height>=800,id);
    assert.ok(Math.abs(meta.width/meta.height-1.25)<.04,id);
    assert.equal(meta.hasAlpha,true,id);
    const crop=bounds(meta.width,meta.height,6,9);
    const buffer=await sharp(source).extract(crop).png().toBuffer();
    const cropped=await sharp(buffer).metadata();
    assert.equal(cropped.width,crop.width);
    assert.equal(cropped.height,crop.height);
    const frame=SpriteArt.advancedRect(meta.width,meta.height,7,9);
    assert.equal(frame.sx,crop.left);
    assert.equal(frame.sy,crop.top);
  }
});

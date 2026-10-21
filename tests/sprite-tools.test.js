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

test('Sharp reads both uploaded PNG sources with expected dimensions and transparency',async()=>{
  for(const id of ['pallet-0','pallet-3']){
    const source=sourceFor(id),meta=await sharp(source).metadata();
    assert.equal(meta.format,'png');
    assert.equal(meta.width,1402);
    assert.equal(meta.height,1122);
    assert.equal(meta.hasAlpha,true);
    const crop=bounds(meta.width,meta.height,6,9);
    const buffer=await sharp(source).extract(crop).png().toBuffer();
    const cropped=await sharp(buffer).metadata();
    assert.equal(cropped.width,crop.width);
    assert.equal(cropped.height,crop.height);
  }
});

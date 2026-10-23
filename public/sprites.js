'use strict';
/**
 * BOOMSHAKALAKA shared atlas renderer.
 * Legacy: 3 columns x 3 rows, nine key poses.
 * Advanced: 10 columns x 7 painted rows (70 frames total).
 * Game retains eight directions: missing West is mirrored from the East row.
 *
 * Advanced columns:
 * 0 idle A, 1 idle B, 2-5 run A-D, 6-7 dribble A-B,
 * 8 pass windup, 9 pass release.
 *
 * Every action keeps the character's directional artwork. Actions without a
 * dedicated painted pose (shoot/block/dunk/celebrate) reuse the closest key
 * poses; they are NOT additional hand-painted animation frames.
 * Optional legacy 3x3 sheets remain supported if later re-added.
 */
const SpriteArt=(()=>{
  const characters=Object.freeze({
    'pallet-0':'pallet/Pallet - Ash.png',
    'pallet-1':'pallet/Pallet - Gary.png',
    'pallet-2':'pallet/Pallet - Professor.png',
    'pallet-3':'pallet/Pallet - Leaf.png',
    'pewter-0':'pewter/Pewter - Brock.png',
    'pewter-1':'pewter/Pewter - Flint.png',
    'pewter-2':'pewter/Pewter - Opal.png',
    'pewter-3':'pewter/Pewter - Boulder.png'
  });
  // All eight 7x10 atlases use their normalized .png filenames.
  const directional=Object.freeze({
    'pallet-0':'pallet/ash.png',
    'pallet-1':'pallet/gary.png',
    'pallet-2':'pallet/professor.png',
    'pallet-3':'pallet/leaf.png',
    'pewter-0':'pewter/brock.png',
    'pewter-1':'pewter/flint.png',
    'pewter-2':'pewter/opal.png',
    'pewter-3':'pewter/boulder.png'
  });
  const cells=Object.freeze(['idle','run-a','run-b','dribble','pass','shoot','block','dunk','celebrate']);
  const directions=Object.freeze(['N','NE','E','SE','S','SW','W','NW']);
  const advancedColumns=Object.freeze(['idle-a','idle-b','run-a','run-b','run-c','run-d',
    'dribble-a','dribble-b','pass-windup','pass-release']);
  const cache=new Map(),observers=new Set();
  const cols=3,rows=3,W=48,H=64,ADV_COLS=10,ADV_ROWS=7;
  // Uploaded seven-row artwork: N, NE, E, SE, S, SW, NW.
  // West has no unique painted row; flip the east-facing sheet horizontally.
  const advancedDirections=Object.freeze([
    {row:0,flipX:false}, // N
    {row:1,flipX:false}, // NE
    {row:2,flipX:false}, // E
    {row:3,flipX:false}, // SE
    {row:4,flipX:false}, // S
    {row:5,flipX:false}, // SW
    {row:2,flipX:true},  // W (mirrored E)
    {row:6,flipX:false}  // NW
  ]);
  const root='/assets/sprites/';
  const duration=Object.freeze({
    idle:.55,run:.115,dribble:.16,pass:.14,
    shoot:.21,block:.16,jump:.16,dunk:.2,celebrate:.35
  });
  // Only idle/run/dribble/pass have purpose-drawn 70-frame poses.
  // Other actions remain character-consistent directional stand-ins.
  const sequences=Object.freeze({
    idle:[0,1],run:[2,3,4,5],dribble:[6,7],pass:[8,9],
    shoot:[8,9],block:[0,9],jump:[0,9],dunk:[2,9],celebrate:[0,1]
  });
  const holdLast=new Set(['pass','shoot','block','jump','dunk']);
  function getId(player){
    const id=player?.profileId||player?.spriteId||player?.id;
    return typeof id==='string'?id:null;
  }
  function encode(relative){return root+relative.split('/').map(encodeURIComponent).join('/')}
  function filePath(id,variant='legacy'){
    const path=(variant==='advanced'?directional:characters)[id];
    return path?encode(path):null;
  }
  function advancedPath(id){return filePath(id,'advanced')}
  function cacheKey(id,variant){return variant+':'+id}
  function state(id,variant='legacy'){
    return cache.get(cacheKey(id,variant))?.state||(!filePath(id,variant)?'unavailable':'unloaded');
  }
  function load(id,variant='legacy'){
    const src=filePath(id,variant);
    if(!src||typeof Image==='undefined')return null;
    const key=cacheKey(id,variant);
    if(cache.has(key))return cache.get(key);
    const entry={id,variant,src,state:'loading',image:null,error:null};
    cache.set(key,entry);
    const img=new Image();
    entry.image=img;
    img.onload=()=>{
      const cw=variant==='advanced'?ADV_COLS:cols,ch=variant==='advanced'?ADV_ROWS:rows;
      if(img.naturalWidth<cw||img.naturalHeight<ch){entry.state='error';entry.error='Invalid atlas dimensions'}
      else entry.state='ready';
      for(const f of observers)f(id,entry);
    };
    img.onerror=()=>{entry.state='error';entry.error='Could not load '+src;
      for(const f of observers)f(id,entry)};
    img.src=src;
    return entry;
  }
  function preloadTeam(teamId){
    for(const id of Object.keys(directional))if(id.startsWith(teamId+'-')){
      load(id,'advanced');
    }
  }
  function preloadMatch(teamIds){for(const id of teamIds||[])preloadTeam(id)}
  function onChange(fn){observers.add(fn);return ()=>observers.delete(fn)}
  function directionFromVector(dx,dy,fallback=4){
    if(!Number.isFinite(dx)||!Number.isFinite(dy)||dx*dx+dy*dy<.001)return fallback;
    return ((Math.round(Math.atan2(dx,-dy)/(Math.PI/4))%8)+8)%8;
  }
  function frameFor(animation,time=0,identity=0){
    switch(animation){
      case 'run':return 1+(Math.floor(time*7+identity)%2);
      case 'dribble':return 3;
      case 'pass':return 4;
      case 'shoot':return 5;
      case 'jump':case 'block':return 6;
      case 'dunk':return 7;
      case 'celebrate':return 8;
      default:return 0;
    }
  }
  function advancedFrameFor(animation,seconds=0){
    const list=sequences[animation]||sequences.idle;
    const frameTime=duration[animation]||duration.idle;
    // Epsilon keeps exact frame boundaries stable across floating-point rounding.
    const index=Math.max(0,Math.floor(Math.max(0,seconds)/frameTime+1e-7));
    return holdLast.has(animation)?list[Math.min(index,list.length-1)]:list[index%list.length];
  }
  function sourceRect(imageWidth,imageHeight,index,layout={}){
    const marginX=Number(layout.marginX)||0,marginY=Number(layout.marginY)||0;
    const gapX=Number(layout.gapX)||0,gapY=Number(layout.gapY)||0;
    const cellW=(imageWidth-2*marginX-2*gapX)/cols;
    const cellH=(imageHeight-2*marginY-2*gapY)/rows;
    const row=Math.floor(index/cols),column=index%cols;
    const inset=Math.max(0,Number(layout.inset)||0);
    return {sx:marginX+column*(cellW+gapX)+inset,
      sy:marginY+row*(cellH+gapY)+inset,
      sw:Math.max(1,cellW-inset*2),sh:Math.max(1,cellH-inset*2)};
  }
  function advancedRect(imageWidth,imageHeight,direction,column){
    const dir=((Math.trunc(Number.isFinite(direction)?direction:4)%8)+8)%8;
    const {row,flipX}=advancedDirections[dir];
    const col=Math.max(0,Math.min(ADV_COLS-1,Math.trunc(Number.isFinite(column)?column:0)));
    // Independent integer boundaries agree precisely with Sharp extraction.
    // The 1402 x 1122 images are not evenly divisible by 10 x 7.
    const sx=Math.round(col*imageWidth/ADV_COLS);
    const sy=Math.round(row*imageHeight/ADV_ROWS);
    const ex=Math.round((col+1)*imageWidth/ADV_COLS);
    const ey=Math.round((row+1)*imageHeight/ADV_ROWS);
    return {sx,sy,sw:ex-sx,sh:ey-sy,flipX,row};
  }
  /**
   * Always use the advanced atlas when available, including stand-in poses
   * for shoot/block/dunk/celebrate, so player identity never vanishes.
   * For unsupported characters or loading errors drawAvatar handles fallback.
   * (x,y) is the court-floor anchor, independent of animation orientation.
   */
  function draw(c,player,x,y,scale=1,time=0,animation='idle',opts={}){
    const id=getId(player);
    const mode=directional[id]?'advanced':'legacy';
    const entry=load(id,mode);
    if(!entry||entry.state!=='ready'){
      // If advanced asset is slow or invalid, maintain old artwork instead.
      if(mode==='advanced')return drawLegacy(c,id,x,y,scale,time,animation,opts);
      return false;
    }
    if(mode==='legacy')return drawLegacy(c,id,x,y,scale,time,animation,opts);
    const direction=Number.isInteger(opts.direction)?opts.direction:
      Number.isInteger(player.facing8)?player.facing8:(player.face<0?6:2);
    const col=Number.isInteger(opts.frame)?opts.frame:advancedFrameFor(animation,opts.animTime??time);
    const {sx,sy,sw,sh,flipX}=advancedRect(entry.image.naturalWidth,entry.image.naturalHeight,direction,col);
    // Uploaded directional cells are approximately square (not 3:4).
    // Preserve their original aspect ratio to avoid squashing heads/faces.
    const fit=58*scale/Math.max(sw,sh),dw=sw*fit,dh=sh*fit;
    c.save();
    c.imageSmoothingEnabled=false;
    c.translate(Math.round(x),Math.round(y));
    if(flipX)c.scale(-1,1);
    c.drawImage(entry.image,sx,sy,sw,sh,-dw/2,-dh+4*scale,dw,dh);
    c.restore();
    return true;
  }
  function drawLegacy(c,id,x,y,scale,time,animation,opts={}){
    const entry=load(id,'legacy');
    if(!entry||entry.state!=='ready')return false;
    const ordinal=/-(\d+)$/.test(id)?Number(id.match(/-(\d+)$/)[1]):0;
    const frame=Number.isInteger(opts.legacyFrame)?opts.legacyFrame:frameFor(animation,time,ordinal);
    const {sx,sy,sw,sh}=sourceRect(entry.image.naturalWidth,entry.image.naturalHeight,frame,opts.layout);
    const dw=W*scale,dh=H*scale;
    c.save();c.imageSmoothingEnabled=false;c.translate(Math.round(x),Math.round(y));
    if(opts.face<0)c.scale(-1,1);
    c.drawImage(entry.image,sx,sy,sw,sh,-dw/2,-dh+4*scale,dw,dh);
    c.restore();
    return true;
  }
  function inspect(id,variant='legacy'){
    const e=cache.get(cacheKey(id,variant));
    return {id,variant,path:filePath(id,variant),state:state(id,variant),
      width:e?.image?.naturalWidth||null,height:e?.image?.naturalHeight||null,error:e?.error||null};
  }
  return {characters,directional,cells,directions,advancedColumns,advancedDirections,ADV_COLS,ADV_ROWS,W,H,cols,rows,
    filePath,advancedPath,state,load,preloadTeam,preloadMatch,onChange,
    directionFromVector,frameFor,advancedFrameFor,sourceRect,advancedRect,draw,inspect};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SpriteArt;

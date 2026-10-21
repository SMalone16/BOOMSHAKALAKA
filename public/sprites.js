'use strict';
/**
 * BOOMSHAKALAKA sprite-sheet runtime.
 * 3 columns x 3 rows, mapped to the nine production key poses.
 * Uses source filenames as uploaded; no renaming or CDN required.
 * The fallback drawAvatar remains available while assets load.
 *
 * Each source sheet can be any resolution with a 3:4 overall aspect ratio.
 * We slice its nine equal cells and scale each to a logical 48x64 frame.
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
  const cells=Object.freeze(['idle','run-a','run-b','dribble','pass','shoot','block','dunk','celebrate']);
  const cache=new Map();
  const observers=new Set();
  const cols=3,rows=3,W=48,H=64;
  const root='/assets/sprites/';
  function getId(player){
    // Live players have numeric court slot IDs, so use their persistent roster ID.
    const id=player?.profileId||player?.spriteId||player?.id;
    return typeof id==='string'?id:null;
  }
  function filePath(id){return characters[id]?root+characters[id].split('/').map(encodeURIComponent).join('/'):null}
  function state(id){return cache.get(id)?.state||(!filePath(id)?'unavailable':'unloaded')}
  function load(id){
    const src=filePath(id);
    if(!src||typeof Image==='undefined')return null;
    if(cache.has(id))return cache.get(id);
    const entry={id,src,state:'loading',image:null,error:null};
    cache.set(id,entry);
    const img=new Image();
    entry.image=img;
    img.onload=()=>{
      if(img.naturalWidth<3||img.naturalHeight<3){entry.state='error';entry.error='Image too small'}
      else entry.state='ready';
      for(const f of observers)f(id,entry);
    };
    img.onerror=()=>{entry.state='error';entry.error='Could not load '+src;for(const f of observers)f(id,entry)};
    img.src=src;
    return entry;
  }
  function preloadTeam(teamId){
    for(const id of Object.keys(characters))if(id.startsWith(teamId+'-'))load(id);
  }
  function preloadMatch(teamIds){for(const teamId of teamIds||[])preloadTeam(teamId)}
  function onChange(fn){observers.add(fn);return ()=>observers.delete(fn)}
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
  // Rectangles use fractional coordinates to preserve the 1086x1448 layout,
  // whose 1448px height is not exactly divisible by 3.
  function sourceRect(imageWidth,imageHeight,index,layout={}){
    const marginX=Number(layout.marginX)||0,marginY=Number(layout.marginY)||0;
    const gapX=Number(layout.gapX)||0,gapY=Number(layout.gapY)||0;
    const cellW=(imageWidth-2*marginX-2*gapX)/cols;
    const cellH=(imageHeight-2*marginY-2*gapY)/rows;
    const row=Math.floor(index/cols),column=index%cols;
    const inset=Math.max(0,Number(layout.inset)||0);
    return {
      sx:marginX+column*(cellW+gapX)+inset,
      sy:marginY+row*(cellH+gapY)+inset,
      sw:Math.max(1,cellW-inset*2),
      sh:Math.max(1,cellH-inset*2)
    };
  }
  /**
   * Draw with the character's feet at (x,y).
   * draw(...) returns false when no available frame, to allow safe fallback.
   * Scale 1 means a 48x64 logical sprite, independent of original PNG resolution.
   */
  function draw(c,player,x,y,scale=1,time=0,animation='idle',opts={}){
    const id=getId(player),entry=load(id);
    if(!entry||entry.state!=='ready')return false;
    const img=entry.image;
    const ordinal=/-(\d+)$/.test(id)?Number(id.match(/-(\d+)$/)[1]):0;
    const frame=Number.isInteger(opts.frame)?opts.frame:frameFor(animation,time,ordinal);
    const {sx,sy,sw,sh}=sourceRect(img.naturalWidth,img.naturalHeight,frame,opts.layout);
    const drawWidth=W*scale,drawHeight=H*scale;
    c.save();
    c.imageSmoothingEnabled=false;
    c.translate(Math.round(x),Math.round(y));
    if(opts.face<0)c.scale(-1,1);
    c.drawImage(img,sx,sy,sw,sh,-drawWidth/2,-drawHeight+4*scale,drawWidth,drawHeight);
    c.restore();
    return true;
  }
  function inspect(id){
    const e=cache.get(id);
    return {id,path:filePath(id),state:state(id),width:e?.image?.naturalWidth||null,height:e?.image?.naturalHeight||null,error:e?.error||null};
  }
  return {characters,cells,W,H,cols,rows,filePath,state,load,preloadTeam,preloadMatch,onChange,frameFor,sourceRect,draw,inspect};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SpriteArt;

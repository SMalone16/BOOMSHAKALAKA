'use strict';
/**
 * Development-only sprite atlas diagnostics and frame extraction.
 * npm run sprites:check
 * npm run sprites:slice -- pallet-0
 * npm run sprites:slice -- pallet-3
 * npm run sprites:slice -- all
 *
 * Does not alter the original atlas. Output under build/sprite-frames/ is
 * gitignored. Use generated manifest to inspect all 70 individually.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const atlas=require('../public/sprites.js');
const root=path.resolve(__dirname,'../public/assets/sprites');
const target=path.resolve(__dirname,'../build/sprite-frames');
const COLS=atlas.ADV_COLS,ROWS=atlas.ADV_ROWS;

function sourceFor(id){
  const relative=atlas.directional[id];
  if(!relative)throw Error('Unknown advanced atlas '+id+'. Valid: '+Object.keys(atlas.directional).join(', '));
  const full=path.resolve(root,relative);
  if(!full.startsWith(root+path.sep))throw Error('Unsafe sprite path');
  return full;
}
function bounds(width,height,row,col){
  // Rounding *boundaries*, not widths, prevents cumulative fractional drift
  // when 1402 px is divided into 10 and 1122 px into 7.
  const left=Math.round(col*width/COLS),right=Math.round((col+1)*width/COLS);
  const top=Math.round(row*height/ROWS),bottom=Math.round((row+1)*height/ROWS);
  return {left,top,width:right-left,height:bottom-top};
}
async function inspect(id){
  const filename=sourceFor(id),metadata=await sharp(filename).metadata();
  if(metadata.format!=='png')throw Error(id+': not a PNG');
  if(!metadata.hasAlpha)throw Error(id+': no transparency/alpha channel');
  if(metadata.width<COLS*12||metadata.height<ROWS*12)throw Error(id+': too small');
  const {data,info}=await sharp(filename).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const channels=info.channels;
  let blank=[],edgeCells=[],lowCoverage=[],transparent=0;
  for(let i=3;i<data.length;i+=channels)if(data[i]===0)transparent++;
  for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
    const b=bounds(metadata.width,metadata.height,row,col);
    let visible=0,edge=0;
    for(let y=b.top;y<b.top+b.height;y++)for(let x=b.left;x<b.left+b.width;x++){
      const alpha=data[(y*info.width+x)*channels+3];
      if(alpha>16){
        visible++;
        if(x===b.left||x===b.left+b.width-1||y===b.top||y===b.top+b.height-1)edge++;
      }
    }
    const key='r'+row+'c'+col;
    if(!visible)blank.push(key);
    if(edge)edgeCells.push(key);
    if(visible>0&&visible/(b.width*b.height)<.01)lowCoverage.push(key);
  }
  const report={id,file:path.relative(root,filename),width:metadata.width,height:metadata.height,
    columns:COLS,rows:ROWS,frames:COLS*ROWS,
    alphaTransparentPercent:+(transparent/(info.width*info.height)*100).toFixed(1),
    emptyFrames:blank,edgeTouchingFrames:edgeCells,lowCoverageFrames:lowCoverage};
  console.log(JSON.stringify(report,null,2));
  if(blank.length)throw Error(id+': '+blank.length+' blank frames. Check sheet geometry/art placement');
  if(!transparent)throw Error(id+': alpha channel exists but no transparent pixels were found');
  if(edgeCells.length)console.warn(id+': '+edgeCells.length+' frames touch a cell boundary; inspect for clipping');
  return {file:filename,metadata,report};
}
async function slice(id){
  const {file,metadata}=await inspect(id);
  const outDir=path.join(target,id);
  await fs.mkdir(outDir,{recursive:true});
  const frames=[];
  for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
    const box=bounds(metadata.width,metadata.height,row,col);
    const name='r'+String(row).padStart(2,'0')+'_c'+String(col).padStart(2,'0')+'.png';
    await sharp(file).extract(box).png().toFile(path.join(outDir,name));
    frames.push({row,column:col,pose:atlas.advancedColumns[col],filename:name,...box});
  }
  const manifest={character:id,source:path.relative(root,file),rows:ROWS,columns:COLS,
    rowLabels:['N','NE','E','SE','S','SW','NW'],
    eightWayDirections:atlas.directions.map((direction,index)=>({
      direction,...atlas.advancedDirections[index]
    })),frames};
  await fs.writeFile(path.join(outDir,'atlas.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Extracted '+frames.length+' frames for '+id+' to '+outDir);
}
async function main(){
  const command=process.argv[2]||'validate',targetId=process.argv[3]||'all';
  if(!['validate','slice'].includes(command))throw Error('Usage: sprite-tools.cjs validate | slice <pallet-0|pallet-3|all>');
  const ids=targetId==='all'?Object.keys(atlas.directional):[targetId];
  for(const id of ids)if(command==='slice')await slice(id);else await inspect(id);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={bounds,sourceFor,inspect,slice};

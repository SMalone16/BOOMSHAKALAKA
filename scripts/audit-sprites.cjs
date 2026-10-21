'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../public/assets/sprites');

const zlib=require('node:zlib');
function scanAlpha(png,w,h){
 // Decode standard 8-bit RGBA PNG rows to measure whether the uploaded
 // source really contains transparent background pixels.
 let position=8;const chunks=[];
 while(position<png.length){
  const size=png.readUInt32BE(position),type=png.toString('ascii',position+4,position+8);
  if(type==='IDAT')chunks.push(png.subarray(position+8,position+8+size));
  position+=12+size;
  if(type==='IEND')break;
 }
 const data=zlib.inflateSync(Buffer.concat(chunks));
 const stride=w*4,previous=Buffer.alloc(stride),current=Buffer.alloc(stride);
 let off=0,zero=0,partial=0,total=0,corner=[];
 for(let y=0;y<h;y++){
  const filter=data[off++];
  for(let x=0;x<stride;x++){
   const raw=data[off++],a=x>=4?current[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;
   let predictor=0;
   if(filter===1)predictor=a;
   else if(filter===2)predictor=b;
   else if(filter===3)predictor=Math.floor((a+b)/2);
   else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c}
   else if(filter!==0)throw Error('Unrecognized PNG row filter '+filter);
   current[x]=(raw+predictor)&255;
  }
  for(let x=0;x<w;x+=8){
   const alpha=current[x*4+3];total++;if(alpha===0)zero++;else if(alpha!==255)partial++;
  }
  if([0,Math.floor(h/3),Math.floor(h*2/3),h-1].includes(y)){
   for(const x of [0,Math.floor(w/3),Math.floor(w*2/3),w-1]){
    const k=x*4;corner.push([current[k],current[k+1],current[k+2],current[k+3]]);
   }
  }
  current.copy(previous);
 }
 return {transparentPercent:Math.round(zero/total*1000)/10,partialAlphaPercent:Math.round(partial/total*1000)/10,samples:corner.slice(0,12)};
}

for(const dir of ['pallet','pewter']){
 for(const name of fs.readdirSync(path.join(root,dir)).filter(s=>/\.png$/i.test(s)).sort()){
  const file=fs.readFileSync(path.join(root,dir,name));
  if(file.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Invalid PNG: '+name);
  const w=file.readUInt32BE(16),h=file.readUInt32BE(20),depth=file[24],type=file[25];
  const alpha=(type===4||type===6)||file.includes(Buffer.from('tRNS','ascii'));
  console.log(JSON.stringify({file:dir+'/'+name,bytes:file.length,width:w,height:h,aspect:Math.round(w/h*1000)/1000,depth,colorType:type,alpha,cellWidth:w/3,cellHeight:h/3,idealRatio:Math.abs(w/h-0.75)<.04,...(type===6&&depth===8?scanAlpha(file,w,h):{})}));
 }
}

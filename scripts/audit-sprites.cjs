'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../public/assets/sprites');
for(const dir of ['pallet','pewter']){
 for(const name of fs.readdirSync(path.join(root,dir)).filter(s=>/\.png$/i.test(s)).sort()){
  const file=fs.readFileSync(path.join(root,dir,name));
  if(file.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Invalid PNG: '+name);
  const w=file.readUInt32BE(16),h=file.readUInt32BE(20),depth=file[24],type=file[25];
  const alpha=(type===4||type===6)||file.includes(Buffer.from('tRNS','ascii'));
  console.log(JSON.stringify({file:dir+'/'+name,bytes:file.length,width:w,height:h,aspect:Math.round(w/h*1000)/1000,depth,colorType:type,alpha,cellWidth:w/3,cellHeight:h/3,idealRatio:Math.abs(w/h-0.75)<.04}));
 }
}

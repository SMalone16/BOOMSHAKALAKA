'use strict';
const $=id=>document.getElementById(id);
const c=$('portrait').getContext('2d');
const source=$('raw');
const chooser=$('who'),direction=$('direction'),motion=$('motion');
for(const [i,name] of SpriteArt.directions.entries()){
 const option=document.createElement('option');option.value=String(i);option.textContent=name;direction.append(option);
}
direction.value='3';
let clock=0,last=0;
for(let i=0;i<10;i++){const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;
 canvas.title=SpriteArt.advancedColumns[i];$('frames').append(canvas)}
function inspect(){
 const id=chooser.value;
 source.src=SpriteArt.advancedPath(id);
 SpriteArt.load(id,'advanced');
 const entry=SpriteArt.inspect(id,'advanced');
 $('status').textContent=JSON.stringify(entry,null,2);
 const sprite=SpriteArt.load(id,'advanced'),img=sprite?.image;
 if(!img||sprite.state!=='ready')return;
 for(let i=0;i<10;i++){
   const dst=$('frames').children[i],ctx=dst.getContext('2d');ctx.clearRect(0,0,48,64);
   const rect=SpriteArt.advancedRect(img.naturalWidth,img.naturalHeight,Number(direction.value),i);
   ctx.imageSmoothingEnabled=false;
   const ratio=Math.min(48/rect.sw,64/rect.sh);
   const dw=rect.sw*ratio,dh=rect.sh*ratio;
   ctx.drawImage(img,rect.sx,rect.sy,rect.sw,rect.sh,(48-dw)/2,64-dh,dw,dh);
 }
}
function animate(now){
 const delta=last?Math.min(.06,(now-last)/1000):0;last=now;clock+=delta;
 c.clearRect(0,0,240,320);
 c.imageSmoothingEnabled=false;
 const athlete={profileId:chooser.value,facing8:Number(direction.value)};
 // Drawing at 4x game-scale makes individual frame changes visible.
 SpriteArt.draw(c,athlete,120,274,4,clock,motion.value,{direction:Number(direction.value),animTime:clock});
 requestAnimationFrame(animate);
}
function changed(){clock=0;inspect()}
SpriteArt.onChange((id,entry)=>{if(chooser.value===id&&entry.variant==='advanced')inspect()});
chooser.addEventListener('change',changed);direction.addEventListener('change',changed);
motion.addEventListener('change',changed);$('replay').addEventListener('click',changed);
inspect();requestAnimationFrame(animate);

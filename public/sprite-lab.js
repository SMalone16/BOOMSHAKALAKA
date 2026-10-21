'use strict';
const $=id=>document.getElementById(id);
const picker=$('character');
for(const [id,filename] of Object.entries(SpriteArt.characters)){
 const option=document.createElement('option');option.value=id;option.textContent=filename;picker.append(option);
}
for(let i=0;i<9;i++){
 const item=document.createElement('div');item.className='frame';
 const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64;
 const label=document.createElement('span');label.textContent=(i+1)+'. '+SpriteArt.cells[i].toUpperCase();
 item.append(canvas,label);$('frames').append(item);
}
function settings(){return Object.fromEntries(['inset','marginX','marginY','gapX','gapY'].map(k=>[k,Number($(k).value)||0]))}
function paint(){
 const id=picker.value,entry=SpriteArt.load(id),img=entry?.image;
 $('source').src=SpriteArt.filePath(id)||'';
 if(!img||entry.state!=='ready'){
  $('dimensions').textContent='Loading '+id+'…';
  return;
 }
 $('dimensions').textContent=img.naturalWidth+' × '+img.naturalHeight+' px — '+entry.state+' — 3 columns × 3 rows';
 const frames=$('frames').querySelectorAll('canvas'),layout=settings();
 for(let i=0;i<9;i++){
  const canvas=frames[i],c=canvas.getContext('2d');c.clearRect(0,0,48,64);c.imageSmoothingEnabled=false;
  const {sx,sy,sw,sh}=SpriteArt.sourceRect(img.naturalWidth,img.naturalHeight,i,layout);
  c.drawImage(img,sx,sy,sw,sh,0,0,48,64);
 }
 // Inspect actual image pixels rather than assuming RGBA means transparent.
 const preview=document.createElement('canvas');preview.width=144;preview.height=192;
 const c=preview.getContext('2d',{willReadFrequently:true});
 c.drawImage(img,0,0,144,192);
 const pixels=c.getImageData(0,0,144,192).data;
 let transparent=0,total=pixels.length/4,partial=0;
 for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;else if(pixels[i]<255)partial++}
 $('diagnostics').textContent='Alpha scan: '+Math.round(transparent/total*100)+'% fully transparent, '+
  Math.round(partial/total*100)+'% partially transparent. Layout: '+JSON.stringify(layout)+
  '. Source: '+SpriteArt.filePath(id);
}
SpriteArt.onChange(id=>{if(id===picker.value)paint()});
picker.addEventListener('change',paint);
for(const name of ['inset','marginX','marginY','gapX','gapY'])$(name).addEventListener('input',paint);
$('reset').addEventListener('click',()=>{
 for(const name of ['inset','marginX','marginY','gapX','gapY'])$(name).value=0;
 paint();
});
paint();

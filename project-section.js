'use strict';
window.ProjectSection=(()=>{
 const MAX_BYTES=12*1024*1024;
 const previewUrls=new Map();
 function fileCheck(file){
  if(!file||!file.name)return false;
  if(!file.size)throw Error('Выбранный файл пустой. Выберите другое изображение.');
  if(file.size>MAX_BYTES)throw Error('Изображение больше 12 МБ. Уменьшите его и выберите снова.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите изображение JPG, PNG или WebP. PDF-чертёж сначала сохраните как изображение.');
  return true;
 }
 for(const [id,prefix] of [['projectPhoto','photo'],['projectScheme','scheme']]){
  const input=document.getElementById(id);const preview=document.getElementById(prefix+'-preview');const error=document.getElementById(prefix+'-error');
  function reset(){if(previewUrls.has(id)){URL.revokeObjectURL(previewUrls.get(id));previewUrls.delete(id);}preview.hidden=true;preview.querySelector('img').removeAttribute('src');preview.querySelector('img').hidden=false;error.textContent='';}
  input.addEventListener('change',()=>{reset();const file=input.files[0];try{if(!fileCheck(file))return;const url=URL.createObjectURL(file);previewUrls.set(id,url);preview.querySelector('img').src=url;preview.querySelector('.upload-name').textContent=file.name;preview.hidden=false;}catch(e){preview.hidden=false;preview.querySelector('img').hidden=true;preview.querySelector('.upload-name').textContent=file?file.name:'';error.textContent=e.message;}});
  document.querySelector('[data-clear="'+id+'"]').addEventListener('click',()=>{input.value='';reset();input.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 window.addEventListener('pagehide',()=>{for(const url of previewUrls.values())URL.revokeObjectURL(url);});
 async function imageBytes(file,kind){
  if(!fileCheck(file))return null;
  const url=URL.createObjectURL(file);const image=new Image();
  try{
   image.src=url;await image.decode();if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('Изображение слишком большое по разрешению. Используйте файл до 40 мегапикселей.');
   const limit=kind==='scheme'?2800:2400;const scale=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d');if(!context)throw Error('Браузер не смог подготовить изображение.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const format=kind==='scheme'?'png':'jpg';const blob=await new Promise(resolve=>canvas.toBlob(resolve,format==='png'?'image/png':'image/jpeg',.92));if(!blob)throw Error('Не удалось обработать изображение.');const bytes=new Uint8Array(await blob.arrayBuffer());canvas.width=1;canvas.height=1;return {bytes,format};
  }catch(e){if(e instanceof Error&&e.name!=='EncodingError')throw e;throw Error('Не удалось прочитать изображение. Выберите исправный JPG, PNG или WebP.');}
  finally{URL.revokeObjectURL(url);}
 }
 async function read(data){
  const fields={};for(const key of ['stairShape','floorHeight','stairWidth','openingLength','openingWidth','stepCount','frameMaterial','stepMaterial','railingMaterial','projectDescription'])fields[key]=String(data.get(key)||'').trim();
  const [photo,scheme]=await Promise.all([imageBytes(data.get('projectPhoto'),'photo'),imageBytes(data.get('projectScheme'),'scheme')]);
  return {...fields,photo,scheme,active:Boolean(photo||scheme||Object.values(fields).some(Boolean))};
 }
 function wrap(font,text,size,width){
  const lines=[];
  for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
   let line='';for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
    const candidate=line?line+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
    if(line){lines.push(line);line='';}for(const ch of word){if(line&&font.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line='';}line+=ch;}
   }lines.push(line);
  }return lines;
 }
 async function render(pdf,project,{regular,bold,client,price,ensureCharacters,fit}){
  if(!project.active)return;
  const {rgb}=window.PDFLib;const dark=rgb(.09,.095,.10),gold=rgb(.83,.64,.24),ink=rgb(.13,.14,.15),muted=rgb(.4,.43,.46),light=rgb(.94,.95,.96),white=rgb(1,1,1);
  const write=(page,value,x,top,size,font=regular,width=888,color=ink)=>{if(!value)return;ensureCharacters(font,value);page.drawText(value,{x,y:540-top,size:fit(font,value,size,width),font,color});};
  pdf.removePage(5);pdf.removePage(4);let position=4;
  function page(title){const p=pdf.insertPage(position++,[960,540]);p.drawRectangle({x:0,y:452,width:960,height:88,color:dark});write(p,title,36,40,25,bold,860,white);write(p,'Для: '+client,36,66,12,regular,860,rgb(.83,.85,.87));write(p,'Иллюстрации на остальных страницах — примеры базовой модели.',36,515,10,regular,850,muted);return p;}
  async function placeImage(p,data,box){const image=await (data.format==='png'?pdf.embedPng(data.bytes):pdf.embedJpg(data.bytes));const scale=Math.min(box.w/image.width,box.h/image.height);const w=image.width*scale,h=image.height*scale;p.drawRectangle({x:box.x,y:540-box.top-box.h,width:box.w,height:box.h,color:light});p.drawImage(image,{x:box.x+(box.w-w)/2,y:540-box.top-box.h+(box.h-h)/2,width:w,height:h});}
  const overview=page('Ваш проект лестницы');
  write(overview,'Стоимость предложения',650,112,11,regular,270,muted);write(overview,price,650,142,24,bold,270,gold);
  if(project.photo){write(overview,'Фото или визуализация проекта',36,110,12,bold,540);await placeImage(overview,project.photo,{x:36,top:124,w:550,h:350});}
  const mm=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Number(value))+' мм';
  const specs=[];
  if(project.stairShape)specs.push(['Форма лестницы',project.stairShape]);
  if(project.floorHeight)specs.push(['Высота между этажами',mm(project.floorHeight)]);
  if(project.openingLength)specs.push(['Длина проёма',mm(project.openingLength)]);
  if(project.openingWidth)specs.push(['Ширина проёма',mm(project.openingWidth)]);
  if(project.stairWidth)specs.push(['Ширина марша',mm(project.stairWidth)]);
  if(project.stepCount)specs.push(['Количество ступеней',new Intl.NumberFormat('ru-RU').format(Number(project.stepCount))]);
  const specsX=project.photo?622:36;let specsY=project.photo?184:132;
  write(overview,'Параметры проекта',specsX,specsY,15,bold,project.photo?300:540);specsY+=25;
  for(const [label,value] of specs){write(overview,label,specsX,specsY,11,regular,300,muted);write(overview,value,specsX,specsY+19,15,bold,300);specsY+=43;}
  if(!specs.length)write(overview,'Размеры в форме не указаны.',specsX,specsY,12,regular,300,muted);
  const blocks=[['Каркас',project.frameMaterial],['Ступени',project.stepMaterial],['Ограждение',project.railingMaterial],['Описание проекта',project.projectDescription]].filter(([,value])=>value);
  if(blocks.length){let detail=page('Описание и комплектация');let top=121;for(const [title,value] of blocks){
   ensureCharacters(regular,value);if(top>449){detail=page('Описание и комплектация — продолжение');top=121;}
   write(detail,title,36,top,12,bold,888,muted);top+=23;
   for(const line of wrap(regular,value,14,888)){if(top>480){detail=page('Описание и комплектация — продолжение');top=121;}if(line)write(detail,line,36,top,14,regular,888);top+=20;}top+=18;
  }}
  if(project.scheme){const schemePage=page('Схема замера');await placeImage(schemePage,project.scheme,{x:36,top:108,w:888,h:379});}
  // Consistent numbering even when an individual section adds pages.
  const all=pdf.getPages();for(let i=1;i<all.length;i++){all[i].drawRectangle({x:922,y:0,width:38,height:31,color:white});write(all[i],`${i+1} / ${all.length}`,925,529,8,regular,33,muted);}
 }
 return {read,render};
})();

'use strict';
const form=document.querySelector('#proposal-form');
const button=document.querySelector('#generate');
const status=document.querySelector('#status');
const result=document.querySelector('#result');
let currentUrl=null;let cachedAssets=null;
async function loadAssets(){
 if(!cachedAssets){cachedAssets=Promise.all(['./assets/imperiya-template.pdf','./assets/GolosText-Regular.ttf','./assets/GolosText-Bold.ttf'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Не удалось загрузить шаблон. Проверьте соединение и попробуйте ещё раз.');return r.arrayBuffer();})).catch(e=>{cachedAssets=null;throw e;});}
 return cachedAssets;
}
function tidy(value){return String(value||'').trim().replace(/\s+/g,' ');}
function fit(font,value,size,width,min=9){let s=size;while(font.widthOfTextAtSize(value,s)>width&&s>min)s-=.25;if(font.widthOfTextAtSize(value,s)>width)throw Error('Текст слишком длинный для шаблона. Сократите имя или адрес сайта.');return s;}
function ensureCharacters(font,value){const available=new Set(font.getCharacterSet());for(const char of value){if(!available.has(char.codePointAt(0)))throw Error('В данных есть символ, который не поддерживает шрифт. Уберите эмодзи и специальные знаки.');}}
function draw(page,value,{x,baseline,size,width,font,color,center=false}){if(!value)return;ensureCharacters(font,value);const s=fit(font,value,size,width);const xx=center?x-font.widthOfTextAtSize(value,s)/2:x;page.drawText(value,{x:xx,y:540-baseline,size:s,font,color});}
form.addEventListener('input',()=>{if(!result.hidden){result.hidden=true;status.textContent='Данные изменены. Сформируйте PDF заново.';status.className='status';}});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const data=new FormData(form);const client=tidy(data.get('client'));const manager=tidy(data.get('manager'));const amount=Number(data.get('amount'));const phone=tidy(data.get('phone'));const website=tidy(data.get('website'));const reviews=tidy(data.get('reviews'));
 if(!client||!manager){status.textContent='Укажите имя клиента и менеджера.';status.className='status error';return;}
 if(!Number.isFinite(amount)||amount<1||amount>999999999){status.textContent='Укажите стоимость от 1 до 999 999 999 ₽.';status.className='status error';return;}
 button.disabled=true;button.textContent='Готовим PDF…';status.className='status';status.textContent='Загружаем шаблон и подставляем данные…';result.hidden=true;
 try{
  if(!window.PDFLib||!window.fontkit)throw Error('Не загрузились компоненты генератора. Обновите страницу и попробуйте снова.');
  const [template,regularBytes,boldBytes]=await loadAssets();
  const {PDFDocument,rgb}=window.PDFLib;const pdf=await PDFDocument.load(template.slice(0));pdf.registerFontkit(window.fontkit);
  const regular=await pdf.embedFont(regularBytes.slice(0),{subset:true});const bold=await pdf.embedFont(boldBytes.slice(0),{subset:true});
  const pages=pdf.getPages();const ink=rgb(.23,.23,.23);const red=rgb(.9,.08,.08);
  draw(pages[0],'Для: '+client,{x:511.27,baseline:327,size:18,width:415,font:bold,color:ink});
  draw(pages[0],'Менеджер: '+manager,{x:511.27,baseline:344.8,size:14,width:415,font:regular,color:ink});
  const price=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:amount%1?2:0,maximumFractionDigits:2}).format(amount)+' ₽';
  draw(pages[5],price,{x:553.66,baseline:125.5,size:22,width:210,font:bold,color:red});
  const date=new Date();const month=new Intl.DateTimeFormat('ru-RU',{month:'long'}).format(date);
  const reviewsLine=reviews?'Более '+new Intl.NumberFormat('ru-RU').format(Number(reviews))+' положительных отзывов на '+month+' '+date.getFullYear():'Отзывы наших клиентов';
  draw(pages[7],reviewsLine,{x:543,baseline:285.4,size:18,width:700,font:bold,color:ink,center:true});
  draw(pages[8],'Ваш менеджер: '+manager,{x:186.26,baseline:445.5,size:12,width:390,font:bold,color:ink});
  draw(pages[8],phone?'тел. '+phone:'',{x:186.26,baseline:460,size:12,width:390,font:regular,color:ink});
  draw(pages[8],website,{x:186.26,baseline:474.4,size:12,width:390,font:regular,color:ink});
  pdf.setTitle('Коммерческое предложение — '+client);pdf.setAuthor('Фабрика стильных лестниц');pdf.setSubject('Лестница «Империя»');pdf.setProducer('Генератор КП — ручное заполнение');pdf.setCreator('Фабрика стильных лестниц');
  const bytes=await pdf.save();const blob=new Blob([bytes],{type:'application/pdf'});if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(blob);
  const safeClient=client.replace(/[<>:"/\\|?*\x00-\x1f]/g,'').slice(0,55);const download=document.querySelector('#download');download.href=currentUrl;download.download='КП-Империя-'+safeClient+'.pdf';document.querySelector('#open-pdf').href=currentUrl;
  document.querySelector('#result-description').textContent=client+' · '+price+' · 9 страниц';result.hidden=false;status.textContent='PDF сформирован. Скачайте его или откройте для проверки.';
  download.click();
 }catch(error){status.textContent=error instanceof Error?error.message:'Не удалось сформировать PDF. Попробуйте ещё раз.';status.className='status error';}
 finally{button.disabled=false;button.textContent='Сформировать PDF';}
});
window.addEventListener('pagehide',()=>{if(currentUrl)URL.revokeObjectURL(currentUrl);});

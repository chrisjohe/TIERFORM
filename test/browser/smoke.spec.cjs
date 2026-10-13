const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const APP=process.env.TIERFORM_APP||path.resolve(__dirname,'../../tierform_app.html');
const FIXTURE=path.resolve(__dirname,'../fixtures/current.json');
const LAYOUTS=['pyramid','tornado','histogram','swimlanes','hive','matrix'];
let errors,requests;

test.beforeEach(async({page})=>{
  errors=[];requests=[];
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('request',request=>{if(/^(https?|wss?):/i.test(request.url()))requests.push(request.url());});
  await page.goto(test.info().project.metadata.distribution==='hosted'
    ? process.env.TIERFORM_HOSTED_URL||'http://127.0.0.1:4173/TIERFORM/' : pathToFileURL(APP).href);
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.start-cards')).toBeVisible();
  requests.length=0;
});
test.afterEach(async()=>{
  expect(errors,'no console, CSP or page errors').toEqual([]);
  expect(requests,'no network activity after static loading').toEqual([]);
});
async function openRoster(page){
  await page.locator('#jsonPick').setInputFiles(FIXTURE);
  await expect(page.locator('#sheet > svg image')).toHaveCount(5);
  await expect(page.locator('#sheet > svg')).toContainText('Alex');
}
async function download(page,command){
  await page.locator('#exportMenuBtn').click();
  const pending=page.waitForEvent('download');
  await page.locator('[data-cmd="'+command+'"]').click();
  const file=await pending,destination=test.info().outputPath(command+'.bin');
  await file.saveAs(destination);
  return fs.readFileSync(destination);
}
async function chart(page){
  return page.locator('#sheet > svg').evaluate(svg=>{
    const raw=svg.outerHTML;
    const ids=new Map([...raw.matchAll(/<clipPath\b[^>]*\bid="([^"]+)"/g)].map((match,index)=>[match[1],'clip'+index]));
    return raw.replace(/(<clipPath\b[^>]*\bid=")([^"]+)(")/g,(_,before,id,after)=>before+ids.get(id)+after)
      .replace(/url\(#([^)]*)\)/g,(_,id)=>'url(#'+(ids.get(id)||id)+')');
  });
}

async function typeTitle(page,text){
  await page.locator('#tab-design').click();
  await page.locator('#headerBtn').click();
  await page.locator('#title').fill(text);
  await page.locator('#title').pressSequentially(' changed');
  await page.locator('#title').press('Enter');
  await page.keyboard.press('Escape');
}

test('boot, layouts, exports and clipboard preserve values',async({page,context,browserName})=>{
  await expect(page.locator('.start-heading')).toHaveText('Start your chart');
  await expect(page.locator('#sheet > svg')).toHaveCount(0);
  await openRoster(page);
  await expect(page.locator('.start-cards')).toHaveCount(0);
  for(const layout of LAYOUTS){
    await page.locator('#layout').selectOption(layout,{force:true});
    await expect(page.locator('#sheet > svg')).toBeVisible();
    expect(await page.locator('#sheet > svg text').count()).toBeGreaterThan(20);
    expect(await chart(page)).not.toContain('NaN');
  }
  const saved=page.waitForEvent('download');
  await page.locator('#qat [data-cmd="save"]').click();
  const rosterFile=await saved,rosterPath=test.info().outputPath('saved-roster.json');
  await rosterFile.saveAs(rosterPath);
  const savedRoster=JSON.parse(fs.readFileSync(rosterPath,'utf8'));
  expect([savedRoster.app,savedRoster.format,savedRoster.people.length]).toEqual(['tierform',1,26]);
  await expect(page.locator('#docIconSaved')).toBeVisible();
  await expect(page.locator('#docIconUnsaved')).toBeHidden();
  const png=await download(page,'exportPng');
  expect(png.length).toBeGreaterThan(10*1024);
  expect(png.subarray(0,4).toString('hex')).toBe('89504e47');
  const pdf=await download(page,'exportPdf');
  expect(pdf.length).toBeGreaterThan(10*1024);
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  const svg=(await download(page,'exportSvg')).toString();
  expect(svg.length).toBeGreaterThan(10*1024);
  expect(svg).not.toMatch(/<script|\son\w+\s*=|javascript:/i);
  expect(await page.evaluate(text=>{
    const doc=new DOMParser().parseFromString(text,'image/svg+xml');
    return !doc.querySelector('parsererror')&&doc.documentElement.nodeName==='svg';
  },svg)).toBe(true);
  const csv=(await download(page,'exportCsv')).toString().replace(/^\uFEFF/,'').split('\r\n');
  expect([csv[0],csv[1],csv.length]).toEqual(['Name;Grade;Group;Role','Alex Adler;P;FRA;',27]);
  if(test.info().project.metadata.distribution==='hosted'){
    if(browserName==='chromium')await context.grantPermissions(['clipboard-read','clipboard-write']);
    const supported=await page.evaluate(()=>typeof ClipboardItem!=='undefined'&&!!navigator.clipboard?.write);
    const button=page.locator('[data-cmd="copyPng"]').first();
    if(supported){await button.click();await expect(page.locator('#toast')).toHaveText('Copied as PNG, 150 dpi — paste into your slide');}
    else await expect(button).toBeDisabled();
  }
});

test('keyboard, modal focus and typing keep one undo session',async({page})=>{
  await openRoster(page);
  await page.locator('#tab-file').focus();
  for(const [key,id] of [['ArrowRight','grades'],['End','design'],['Home','file'],['ArrowLeft','design'],['Home','file']]){
    await page.keyboard.press(key);
    await expect(page.locator('#tab-'+id)).toBeFocused();
    await expect(page.locator('#tab-'+id)).toHaveAttribute('aria-selected','true');
    await expect(page.locator('#pane-'+id)).toBeVisible();
  }
  const opener=page.locator('#pane-file [data-cmd="addPeople"]').first();
  await opener.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#addName')).toBeFocused();
  await expect(page.locator('#shell')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#shell')).toHaveJSProperty('inert',true);
  await page.locator('#addDoneBtn').focus();await page.keyboard.press('Tab');
  await expect(page.locator('#addModal .modal-x')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#addDoneBtn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#addModal')).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('#shell')).not.toHaveAttribute('aria-hidden');
  await expect(page.locator('#shell')).toHaveJSProperty('inert',false);
  const original=await page.locator('#title').inputValue();
  await typeTitle(page,'Session');
  await expect(page.locator('#sheet > svg')).toContainText('Session changed');
  await expect(page.locator('#docIconUnsaved')).toBeVisible();
  await expect(page.locator('#docIconSaved')).toBeHidden();
  await page.locator('#undoBtn').click();
  await expect(page.locator('#title')).toHaveValue(original);
  await expect(page.locator('#sheet > svg')).toContainText(original);
  await page.locator('#redoBtn').click();
  await expect(page.locator('#title')).toHaveValue('Session changed');
});

test('a narrow roster toggle changes visibility without editing the document',async({page})=>{
  await page.setViewportSize({width:780,height:900});
  await page.reload();
  await page.evaluate(()=>document.fonts.ready);requests.length=0;
  await openRoster(page);
  const before=await page.locator('#docStatus').textContent();
  const history=await page.locator('#undoBtn').isDisabled();
  await expect(page.locator('.panel')).toBeHidden();
  const show=page.getByRole('button',{name:'Show the roster panel'});
  await expect(show).toHaveAttribute('title','Show the roster panel');
  await show.click();
  await expect(page.locator('.panel')).toBeVisible();
  const hide=page.getByRole('button',{name:'Hide the roster panel'});
  await expect(hide).toHaveAttribute('title','Hide the roster panel');
  await hide.click();
  await expect(page.locator('.panel')).toBeHidden();
  await expect(show).toBeVisible();
  await expect(page.locator('#docStatus')).toHaveText(before);
  expect(await page.locator('#undoBtn').isDisabled()).toBe(history);
});

test('tour cancellation restores the document, dirty status and undo history',async({page})=>{
  await openRoster(page);
  const original=await page.locator('#title').inputValue();
  await typeTitle(page,'Before tour');
  const before=await chart(page);
  const status=await page.locator('#docStatus').textContent();
  await page.locator('#tab-file').click();await page.locator('#tourBtn').click();
  await expect(page.locator('#tourCard')).toBeVisible();
  await expect(page.locator('#tourNext')).toBeFocused();
  for(let step=0;step<9;step++)await page.locator('#tourNext').click();
  await expect(page.locator('#page')).toHaveValue('portrait');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tourCard')).toBeHidden();
  expect(await chart(page)).toBe(before);
  await expect(page.locator('#docStatus')).toHaveText(status);
  await expect(page.locator('#docIconUnsaved')).toBeVisible();
  await page.locator('#undoBtn').click();
  await expect(page.locator('#title')).toHaveValue(original);
  await page.locator('#redoBtn').click();
  await expect(page.locator('#title')).toHaveValue('Before tour changed');
  await page.locator('#tab-file').click();await page.locator('#tourBtn').click();
  await page.locator('#tourX').click();
  await expect(page.locator('#tourCard')).toBeHidden();
  expect(await chart(page)).toBe(before);
});

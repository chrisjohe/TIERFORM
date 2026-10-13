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

async function savedDocument(page){
  const pending=page.waitForEvent('download');
  await page.locator('#qat [data-cmd="save"]').click();
  const file=await pending,destination=test.info().outputPath('settings-roster.json');
  await file.saveAs(destination);
  return JSON.parse(fs.readFileSync(destination,'utf8'));
}

test('shared design bindings retain every field and undo independently',async({page})=>{
  await openRoster(page);
  const choices={nameBold:'family',font:'arial',bg:'transparent',ring:'white',page:'portrait',density:'tight',nameLabelPosition:'next'};
  for(const [id,value] of Object.entries(choices)) await page.locator('#'+id).selectOption(value,{force:true});
  await page.locator('#tab-design').click();
  const colours={inkOnColour:'#eeeeee',inkOnWhite:'#222222'};
  await page.locator('#textBtn').click();
  for(const [id,value] of Object.entries(colours)) await page.locator('#'+id).evaluate((el,value)=>{
    el.focus();el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.blur();
  },value);
  await page.keyboard.press('Escape');
  await page.locator('#labelsBtn').click();
  await page.locator('#showGradeCode').uncheck();
  await page.locator('#showGradeName').check();
  await page.keyboard.press('Escape');
  await page.locator('#nameLabelsBtn').click();
  for(const id of ['showPersonName','showPersonGrade','showPersonGroup']) await page.locator('#'+id).uncheck();
  await page.keyboard.press('Escape');
  await page.locator('#headerBtn').click();
  await page.locator('#brand').fill('Brand changed');
  await page.locator('#brand').press('Enter');
  await page.keyboard.press('Escape');
  await page.locator('#tab-grades').click();
  await page.locator('[data-cmd="groups"]').click();
  await page.locator('#groupsLabel').fill('Axis changed');
  await page.locator('#groupDoneBtn').click();
  const saved=await savedDocument(page);
  for(const [key,value] of Object.entries({...choices,...colours,showGradeCode:false,showGradeName:true,showPersonName:false,showPersonGrade:false,showPersonGroup:false,brand:'Brand changed',groupsLabel:'Axis changed'})) expect(saved[key],key).toEqual(value);
  await page.locator('#undoBtn').click();
  const undone=await savedDocument(page);
  expect(undone.groupsLabel).not.toBe('Axis changed');
  expect(undone.brand).toBe('Brand changed');
  await page.locator('#redoBtn').click();
  expect((await savedDocument(page)).groupsLabel).toBe('Axis changed');
});

async function panPhoto(page,modal){
  const slider=page.locator(modal+' input[data-fact="zoom"]');
  await slider.focus();
  await slider.evaluate(el=>{el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}));el.blur();});
  const circle=page.locator(modal+' [data-fact="pan"]');
  const before=await circle.locator('img').getAttribute('style');
  const box=await circle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+24,box.y+box.height/2+16,{steps:4});
  await page.mouse.up();
  expect(await circle.locator('img').getAttribute('style')).not.toBe(before);
  await expect(circle).not.toHaveClass(/drag/);
}

test('shared photo panning preserves edit history and pending add isolation',async({page})=>{
  await openRoster(page);
  await page.locator('.p-row:has(img) [data-act="menu"]').first().click();
  await page.locator('#personMenu [data-act="edit"]').click();
  await panPhoto(page,'#editModal');
  const panned=await chart(page);
  await page.locator('#editDoneBtn').click();
  await page.locator('#undoBtn').click();
  expect(await chart(page)).not.toBe(panned);
  await page.locator('#redoBtn').click();
  expect(await chart(page)).toBe(panned);

  const initial=await savedDocument(page),before=await chart(page);
  const photo=initial.people.find(p=>p.photo).photo;
  const destination=test.info().outputPath(photo.startsWith('data:image/png;')?'add-photo.png':'add-photo.jpg');
  fs.writeFileSync(destination,Buffer.from(photo.split(',')[1],'base64'));
  await page.locator('#pane-file [data-cmd="addPeople"]').first().click();
  await page.locator('#addPhoto').setInputFiles(destination);
  await expect(page.locator('#addPhotoWell')).toBeVisible();
  await page.locator('#addName').fill('Framed addition');
  await panPhoto(page,'#addModal');
  expect(await chart(page)).toBe(before);
  await page.locator('#addAddCloseBtn').click();
  const added=await savedDocument(page),person=added.people.at(-1);
  expect(added.people.length).toBe(initial.people.length+1);
  expect(person.name).toBe('Framed addition');
  expect(person.frame.zoom).toBe(1.5);
  expect(person.frame.ox).toBeGreaterThan(0);
  expect(person.frame.oy).toBeGreaterThan(0);
  await page.locator('#undoBtn').click();
  expect(await chart(page)).toBe(before);
});

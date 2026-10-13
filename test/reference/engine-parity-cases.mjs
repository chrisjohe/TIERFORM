const defaults={title:'Team name',brand:'',groupsLabel:'',layout:'pyramid',showGradeCode:true,showGradeName:false,nameLabelPosition:'below',nameBold:'given',font:'open-sans',showPersonName:true,showPersonGrade:true,showPersonGroup:true,accent:'#003153',inkOnColour:'#FFFFFF',inkOnWhite:'#1A2129',bg:'white',ring:'none',angle:2,page:'landscape',density:'balanced',tiers:[],people:[],groups:[]};
const layouts=['pyramid','tornado','histogram','swimlanes','hive','matrix'];
export const textModels=['length','weighted'];
export function measurement(model){return {font:'',measureText(text){
  const size=parseFloat(/([\d.]+)px/.exec(this.font)?.[1]||12),s=String(text??'');
  return {width:model==='weighted'?s.split('').reduce((sum,c)=>sum+(c.charCodeAt(0)%13+3),0)*size*(parseInt(this.font,10)||400)/8000:s.length*size*0.5};
}};}
export function cases(fixture){
  const result=[];
  for(const layout of layouts)for(const density of ['tight','balanced','airy'])for(const angle of [0,1,2,3,4])for(const page of ['landscape','portrait','square'])for(const nameLabelPosition of ['below','next'])for(const nameBold of ['given','family','all','none']){
    const st={...defaults,...fixture,layout,density,angle,page,nameLabelPosition,nameBold},i=result.length;
    st.font=i%2?'arial':'open-sans';st.showGradeName=i%3===0;st.showPersonName=i%7!==0;st.showPersonGrade=i%5!==0;st.showPersonGroup=i%11!==0;
    st.bg=i%2?'transparent':'white';st.ring=['none','accent','white'][i%3];result.push(st);
  }
  for(const layout of layouts)result.push({...defaults,layout},{...defaults,...fixture,layout,people:[]},{...defaults,...fixture,layout,tiers:fixture.tiers.map((t,i)=>({...t,attach:i>0,merge:false}))},{...defaults,...fixture,layout,tiers:fixture.tiers.map((t,i)=>({...t,merge:i>0}))});
  return result;
}
export function normalizedSvg(svg){
  const ids=new Map([...svg.matchAll(/<clipPath id="([^"]+)"/g)].map((m,i)=>[m[1],'clip'+i]));
  return svg.replace(/id="([^"]+)"/g,(full,id)=>ids.has(id)?'id="'+ids.get(id)+'"':full).replace(/url\(#([^)]*)\)/g,(full,id)=>ids.has(id)?'url(#'+ids.get(id)+')':full);
}
export function finiteGeometry(value){
  if(typeof value==='number')return Number.isFinite(value);
  if(value&&typeof value==='object')return Object.values(value).every(finiteGeometry);
  return true;
}

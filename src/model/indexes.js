// These indexes belong to one calculation, never to the mutable document.
function indexById(items){
  const index = new Map();
  for(const item of items || []){
    if(item && !index.has(item.id)) index.set(item.id, item);
  }
  return index;
}

function peopleBy(people, field){
  const groups = new Map();
  for(const person of people){
    const key = person[field];
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(person);
  }
  return groups;
}

function labelIndex(st){
  return {tiers:indexById(st.tiers), groups:indexById(st.groups)};
}

export { indexById, peopleBy, labelIndex };

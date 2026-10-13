// Reproduce adjacent moves without rescanning the roster for every person
// passed. Rotating only a grade's occupied slots preserves interleaved grades
// and therefore the order of saved documents, CSV and merged grid layouts.
function planPersonOrder(people, tiers, person, target, after){
  let grade = tiers.findIndex(t => t.id === person.tierId);
  const destination = tiers.findIndex(t => t.id === target.tierId);
  if(grade < 0 || destination < 0) return null;
  const order = people.slice();
  const slots = () => order.map((p, i) =>
    p === person || p.tierId === tiers[grade].id ? i : -1).filter(i => i >= 0);
  const rotate = (indices, want) => {
    const at = indices.indexOf(order.indexOf(person));
    const dir = want > at ? 1 : -1;
    for(let i = at; i !== want; i += dir) order[indices[i]] = order[indices[i + dir]];
    order[indices[want]] = person;
  };

  const dir = destination > grade ? 1 : -1;
  while(grade !== destination){
    const indices = slots();
    rotate(indices, dir > 0 ? indices.length - 1 : 0);
    grade += dir;
    const members = order.map((p, i) =>
      p !== person && p.tierId === tiers[grade].id ? i : -1).filter(i => i >= 0);
    if(!members.length) continue;
    const from = order.indexOf(person);
    const anchor = dir > 0 ? members[0] : members[members.length - 1];
    order.splice(from, 1);
    const live = anchor - (from < anchor ? 1 : 0);
    order.splice(dir > 0 ? live : live + 1, 0, person);
  }

  const indices = slots();
  const others = indices.filter(i => order[i] !== person);
  const want = others.findIndex(i => order[i] === target) + (after ? 1 : 0);
  rotate(indices, want);
  return order;
}

export { planPersonOrder };

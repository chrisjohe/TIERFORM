import { defaults } from "./defaults.js";

let documentChanged = () => {};
function connectDocument(listener){ documentChanged = listener; }

const documentState = {
  state: defaults(),
  docName: "",
  dirtyDoc: false,
  docGen: 0,
  tourSaved: null
};

function newGeneration(){ documentState.docGen++; }

function staleWrite(gen, want){
  if(gen !== documentState.docGen)
    return "the document changed while it was loading";
  if(want && want.tierId && !documentState.state.tiers.some(t => t.id === want.tierId))
    return "the grade it was going into no longer exists";
  if(want && want.person && documentState.state.people.indexOf(want.person) === -1)
    return "that person is no longer in the roster";
  return null;
}

function markDirty(){ documentState.dirtyDoc = true; documentChanged(); }

export { documentChanged, connectDocument, documentState, newGeneration, staleWrite, markDirty };

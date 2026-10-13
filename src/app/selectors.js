import { documentState } from "../model/document.js";

function tierOf(p){ return documentState.state.tiers.find(t=>t.id===p.tierId) || documentState.state.tiers[0]; }

export { tierOf };

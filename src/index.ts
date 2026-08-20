import { accounts, sampleEvents } from "./data/sampleEvents.js";
import { buildReport } from "./engine/reportBuilder.js";
import { replay } from "./engine/replayEngine.js";

process.stdout.write(buildReport(replay({ accounts, events: sampleEvents })));

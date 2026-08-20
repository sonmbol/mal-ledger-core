import { describe, expect, it } from "vitest";

import { accounts, sampleEvents } from "../src/data/sampleEvents.js";
import { buildReport } from "../src/engine/reportBuilder.js";
import { replay } from "../src/engine/replayEngine.js";

function assessmentReport(): string {
  return buildReport(replay({ accounts, events: sampleEvents }));
}

describe("buildReport", () => {
  it("is byte-for-byte deterministic across independent replays", () => {
    expect(assessmentReport()).toBe(assessmentReport());
  });

  it("includes both daily views, stable rejection codes, and final values", () => {
    const report = assessmentReport();

    expect(report).toContain("AS-OBSERVED CLOSINGS");
    expect(report).toContain("FINAL-RESTATED CLOSINGS");
    expect(report).toContain("E6 [AUTHORIZATION_NOT_FOUND]");
    expect(report).toContain("Final posted: AED 390.93");
    expect(report).toContain("BHD 3.333 / BHD 3.333 / BHD 3.334");
  });
});

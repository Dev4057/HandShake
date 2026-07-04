/**
 * Competency 4 — Quality control. Routes a deliverable to the right verifier by
 * job type and returns a Verdict. One entry point the rest of the app calls.
 */
import type { JobSpec, Deliverable, Verdict } from "../../types.js";
import { verifySql } from "./sql.js";
import { verifyLanding } from "./landing.js";
import { verifyData } from "./data.js";

export function verify(job: JobSpec, deliverable: Deliverable): Verdict {
  switch (job.type) {
    case "sql":
      return verifySql(job, deliverable);
    case "landing":
      return verifyLanding(job, deliverable);
    case "data":
      return verifyData(job, deliverable);
  }
}

import { afterEach, describe, expect, it } from "vitest";

import { submissionOrigin } from "./submission-origin";

afterEach(() => document.body.replaceChildren());

describe("submissionOrigin", () => {
  it("uses the actual submitter when WebKit has not focused it before submit", () => {
    const priorControl = document.createElement("button");
    const submitter = document.createElement("button");
    submitter.type = "submit";
    const form = document.createElement("form");
    form.append(submitter);
    document.body.append(priorControl, form);
    priorControl.focus();

    const submission = new SubmitEvent("submit", { submitter });

    expect(submissionOrigin(submission)).toBe(submitter);
  });

  it("falls back to the active element for a synthetic submission without a submitter", () => {
    const activeControl = document.createElement("button");
    document.body.append(activeControl);
    activeControl.focus();

    expect(submissionOrigin(new Event("submit"))).toBe(activeControl);
  });
});

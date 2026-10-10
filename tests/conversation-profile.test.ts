import { describe, expect, it } from "vitest";
import {
  incomingSocialContext,
  vietnameseAddressForProfile
} from "../src/conversation-profile";
import type { ConversationProfile } from "../src/types";

const profile: ConversationProfile = {
  targetLanguage: "vi",
  incomingLanguage: "auto",
  tone: "natural",
  relationship: "friend",
  relativeAge: "younger",
  recipientGender: "female",
  configured: true
};

describe("conversation relationship profiles", () => {
  it("uses the user's gender when the recipient is younger", () => {
    expect(vietnameseAddressForProfile(profile, "male")).toBe("younger_from_male");
    expect(vietnameseAddressForProfile(profile, "female")).toBe("younger_from_female");
  });

  it("uses the recipient gender when the recipient is older", () => {
    expect(vietnameseAddressForProfile({ ...profile, relativeAge: "older", recipientGender: "male" }, "female"))
      .toBe("older_male");
  });

  it("reverses relative age for incoming translations", () => {
    expect(incomingSocialContext(profile, "male")).toMatchObject({
      speakerGender: "female",
      recipientGender: "male",
      recipientRelativeAge: "older"
    });
  });
});

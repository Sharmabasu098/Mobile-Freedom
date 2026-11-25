import { describe, expect, it } from "vitest";
import { getCommandUiCopy } from "./commandUi";

describe("VF-01.8 homepage command input copy", () => {
  it("provides distinct English labels and placeholder for the command input", () => {
    expect(getCommandUiCopy("en")).toEqual({
      label: "Command",
      placeholder: "Try: compress image, merge PDF, or convert units...",
      submit: "Run command",
      clarify: "Please describe one tool action clearly.",
    });
  });

  it("provides Hindi copy when Hindi is selected", () => {
    expect(getCommandUiCopy("hi")).toEqual({
      label: "कमांड",
      placeholder: "जैसे: फोटो compress करें, PDF जोड़ें...",
      submit: "कमांड चलाएँ",
      clarify: "कृपया एक काम स्पष्ट रूप से बताएं।",
    });
  });

  it("is a separate command-input copy contract, not homepage search copy", () => {
    const commandCopy = getCommandUiCopy("en");
    expect(commandCopy.label).not.toBe("Search");
    expect(commandCopy.placeholder).not.toBe("Search available tools...");
  });
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();

  vi.stubGlobal("document", {
    querySelector: vi.fn(() => null),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("throws an error when the #app element is missing", async () => {
  await expect(import("./main")).rejects.toThrow(
    'Mobile Freedom initialization failed: element "#app" was not found.'
  );
});

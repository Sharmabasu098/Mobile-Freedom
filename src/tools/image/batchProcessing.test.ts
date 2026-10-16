import { describe, expect, it, vi } from "vitest";
import { processBatch } from "./batchProcessing";

describe("processBatch", () => {
  it("processes all items successfully", async () => {
    const processor = vi.fn(
      async (item: number) => item * 2,
    );

    const results = await processBatch(
      [1, 2, 3],
      processor,
    );

    expect(results).toHaveLength(3);

    expect(results).toEqual([
      {
        index: 0,
        item: 1,
        success: true,
        result: 2,
      },
      {
        index: 1,
        item: 2,
        success: true,
        result: 4,
      },
      {
        index: 2,
        item: 3,
        success: true,
        result: 6,
      },
    ]);

    expect(processor).toHaveBeenCalledTimes(3);
  });

  it("continues processing after one item fails", async () => {
    const processor = vi.fn(
      async (item: number) => {
        if (item === 2) {
          throw new Error("Processing failed");
        }

        return item * 10;
      },
    );

    const results = await processBatch(
      [1, 2, 3],
      processor,
    );

    expect(results).toEqual([
      {
        index: 0,
        item: 1,
        success: true,
        result: 10,
      },
      {
        index: 1,
        item: 2,
        success: false,
        error: "Processing failed",
      },
      {
        index: 2,
        item: 3,
        success: true,
        result: 30,
      },
    ]);

    expect(processor).toHaveBeenCalledTimes(3);
  });

  it("returns an empty array for empty input", async () => {
    const processor = vi.fn(
      async (item: number) => item,
    );

    const results = await processBatch(
      [],
      processor,
    );

    expect(results).toEqual([]);
    expect(processor).not.toHaveBeenCalled();
  });

  it("uses a fallback message for non-Error failures", async () => {
    const processor = async () => {
      throw "unexpected failure";
    };

    const results = await processBatch(
      ["image.png"],
      processor,
    );

    expect(results).toEqual([
      {
        index: 0,
        item: "image.png",
        success: false,
        error: "This item could not be processed.",
      },
    ]);
  });

  it("processes items sequentially and preserves their order", async () => {
    const completionOrder: number[] = [];

    const processor = async (item: number) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5);
      });

      completionOrder.push(item);
      return item;
    };

    const results = await processBatch(
      [3, 1, 2],
      processor,
    );

    expect(completionOrder).toEqual([3, 1, 2]);

    expect(results.map((result) => result.item)).toEqual([
      3,
      1,
      2,
    ]);
  });
});

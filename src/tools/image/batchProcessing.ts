/**
 * Mobile Freedom — M5 Batch Processing helper.
 *
 * Processes items sequentially to avoid starting all
 * browser image operations at once.
 *
 * A failed item does not stop later items.
 * This helper does not upload files or create UI.
 */

export interface BatchItemSuccess<T, R> {
  index: number;
  item: T;
  success: true;
  result: R;
}

export interface BatchItemFailure<T> {
  index: number;
  item: T;
  success: false;
  error: string;
}

export type BatchItemResult<T, R> =
  | BatchItemSuccess<T, R>
  | BatchItemFailure<T>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "This item could not be processed.";
}

/**
 * Processes items one at a time.
 * Each item gets an independent success or failure result.
 */
export async function processBatch<T, R>(
  items: readonly T[],
  processor: (item: T, index: number) => Promise<R>,
): Promise<BatchItemResult<T, R>[]> {
  const results: BatchItemResult<T, R>[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    try {
      const result = await processor(item, index);

      results.push({
        index,
        item,
        success: true,
        result,
      });
    } catch (error: unknown) {
      results.push({
        index,
        item,
        success: false,
        error: getErrorMessage(error),
      });
    }
  }

  return results;
  }

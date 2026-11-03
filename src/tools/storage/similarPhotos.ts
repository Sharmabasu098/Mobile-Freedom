/**
 * Mobile Freedom — M9 Similar Photo Detection
 *
 * Estimates visual similarity using local perceptual hashing.
 * Images are decoded and analyzed locally in the browser.
 * Files are never uploaded, modified, or deleted by this module.
 */

export const MAX_SIMILARITY_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_SIMILARITY_DISTANCE = 4;

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const REGION_WIDTH_SCALES = [0.3, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.8, 0.9, 0.95] as const;
const REGION_HEIGHT_SCALES = [0.3, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.78, 0.8, 0.9, 0.95] as const;
const REGION_GRID_STEPS = 8;

const SUPPORTED_SIMILARITY_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface SimilarPhotoPair {
  first: File;
  second: File;
  distance: number;
  similarityPercent: number;
}

export interface SimilarPhotoError {
  file: File;
  error: unknown;
}

export type SimilarPhotoErrorHandler = (
  file: File,
  error: unknown,
) => void;

interface RegionHash {
  hash: string;
  averageHash: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface ImageHashSet {
  file: File;
  width: number;
  height: number;
  wholeImageHash: string;
  wholeImageAverageHash: string;
  regions: RegionHash[];
}

export interface SpatialDirectionEvidence {
  candidateRegionCount: number;
  independentRegionCount: number;
  bestDistance: number | null;
  /** Current matcher accepts when at least one candidate region exists. */
  acceptedBySingleRegionRule: boolean;
  /** Counterfactual only: would this direction pass a two-independent-region rule? */
  acceptedByTwoRegionRule: boolean;
}

export interface CropPairSpatialEvidence {
  areaRatio: number;
  firstComparedAgainstSecond: SpatialDirectionEvidence;
  secondComparedAgainstFirst: SpatialDirectionEvidence;
  currentMatcherWouldAccept: boolean;
  twoRegionRuleWouldAccept: boolean;
}

interface CropMatch {
  distance: number;
  matches: number;
}

const EMPTY_DIRECTION_EVIDENCE: SpatialDirectionEvidence = {
  candidateRegionCount: 0,
  independentRegionCount: 0,
  bestDistance: null,
  acceptedBySingleRegionRule: false,
  acceptedByTwoRegionRule: false,
};

function compareHashSetsWithSpatialEvidence(
  first: ImageHashSet,
  second: ImageHashSet,
  maxDistance: number,
): CropPairSpatialEvidence {
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  const largerArea = Math.max(first.width * first.height, second.width * second.height);
  const areaRatio = smallerArea / largerArea;
  if (areaRatio < 0.08) {
    return {
      areaRatio,
      firstComparedAgainstSecond: EMPTY_DIRECTION_EVIDENCE,
      secondComparedAgainstFirst: EMPTY_DIRECTION_EVIDENCE,
      currentMatcherWouldAccept: false,
      twoRegionRuleWouldAccept: false,
    };
  }

  const MAX_RELATIVE_ASPECT_ERROR = 0.04;
  const MAX_AVERAGE_HASH_DISTANCE = 12;

  const directionalEvidence = (
    candidateImage: ImageHashSet,
    sourceImage: ImageHashSet,
  ): SpatialDirectionEvidence => {
    const candidateAspect = candidateImage.width / candidateImage.height;
    const candidates = sourceImage.regions
      .map(region => {
        const regionAspect =
          (region.width * sourceImage.width) / (region.height * sourceImage.height);
        const relativeAspectError =
          Math.abs(regionAspect - candidateAspect) / candidateAspect;
        return {
          region,
          distance: calculateHashDistance(candidateImage.wholeImageHash, region.hash),
          averageDistance: calculateAverageHashDistance(
            candidateImage.wholeImageAverageHash,
            region.averageHash,
          ),
          relativeAspectError,
        };
      })
      .filter(candidate =>
        candidate.distance <= maxDistance &&
        candidate.averageDistance <= MAX_AVERAGE_HASH_DISTANCE &&
        candidate.relativeAspectError <= MAX_RELATIVE_ASPECT_ERROR
      )
      .sort((a, b) =>
        a.distance - b.distance ||
        a.relativeAspectError - b.relativeAspectError
      );

    const independent = selectSpatiallyIndependentRegions(candidates);
    return {
      candidateRegionCount: candidates.length,
      independentRegionCount: independent.length,
      bestDistance: candidates[0]?.distance ?? null,
      acceptedBySingleRegionRule: candidates.length > 0,
      acceptedByTwoRegionRule: independent.length >= 2,
    };
  };

  const firstComparedAgainstSecond = directionalEvidence(first, second);
  const secondComparedAgainstFirst = directionalEvidence(second, first);
  return {
    areaRatio,
    firstComparedAgainstSecond,
    secondComparedAgainstFirst,
    currentMatcherWouldAccept:
      firstComparedAgainstSecond.acceptedBySingleRegionRule ||
      secondComparedAgainstFirst.acceptedBySingleRegionRule,
    twoRegionRuleWouldAccept:
      firstComparedAgainstSecond.acceptedByTwoRegionRule ||
      secondComparedAgainstFirst.acceptedByTwoRegionRule,
  };
}

/**
 * Diagnostic-only controlled experiment API. It runs the same descriptor
 * generation and region filters as production, then reports the current
 * one-region decision beside a counterfactual two-independent-region rule.
 * It never changes classification, thresholds, files, or production output.
 */
export async function analyzeCropPairSpatialEvidence(
  first: File,
  second: File,
  maxDistance = DEFAULT_SIMILARITY_DISTANCE,
): Promise<CropPairSpatialEvidence> {
  if (!Number.isInteger(maxDistance) || maxDistance < 0 || maxDistance > 64) {
    throw new Error("Similarity distance must be a whole number between 0 and 64.");
  }
  const [firstHashes, secondHashes] = await Promise.all([
    calculateImageHashSet(first),
    calculateImageHashSet(second),
  ]);
  return compareHashSetsWithSpatialEvidence(firstHashes, secondHashes, maxDistance);
}

/**
 * Existing production matcher remains deliberately unchanged: one matching
 * region is still sufficient pending controlled experiment evidence.
 */
function compareHashSets(
  first: ImageHashSet,
  second: ImageHashSet,
  maxDistance: number,
): CropMatch | undefined {
  const evidence = compareHashSetsWithSpatialEvidence(first, second, maxDistance);
  if (!evidence.currentMatcherWouldAccept) return undefined;
  const distances = [
    evidence.firstComparedAgainstSecond.bestDistance,
    evidence.secondComparedAgainstFirst.bestDistance,
  ].filter((value): value is number => value !== null);
  return { distance: Math.min(...distances), matches: 1 };
}

export async function findSimilarPhotos(
  files: File[],
  onError?: SimilarPhotoErrorHandler,
  maxDistance = DEFAULT_SIMILARITY_DISTANCE,
): Promise<SimilarPhotoPair[]> {
  if (
    !Number.isInteger(maxDistance) ||
    maxDistance < 0 ||
    maxDistance > 64
  ) {
    throw new Error(
      "Similarity distance must be a whole number between 0 and 64.",
    );
  }

  const hashedFiles: ImageHashSet[] = [];

  for (const file of files) {
    try {
      hashedFiles.push(await calculateImageHashSet(file));
    } catch (error) {
      onError?.(file, error);
    }
  }

  const pairs: SimilarPhotoPair[] = [];

  for (let firstIndex = 0; firstIndex < hashedFiles.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < hashedFiles.length;
      secondIndex += 1
    ) {
      const first = hashedFiles[firstIndex];
      const second = hashedFiles[secondIndex];
      const match = compareHashSets(
        first,
        second,
        maxDistance,
      );

      if (match) {
        pairs.push({
          first: first.file,
          second: second.file,
          distance: match.distance,
          similarityPercent: Math.round(
            ((64 - match.distance) / 64) * 100,
          ),
        });
      }
    }
  }

  return pairs;
}

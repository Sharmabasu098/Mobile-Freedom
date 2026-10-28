import { describe, expect, it } from "vitest";
import {
  filterMediaFiles,
  getMediaFileKind,
} from "./mediaFiles";

function mediaFile(
  name: string,
  type = "",
): File {
  return new File(["sample"], name, { type });
}

describe("M9 Media File Classification", () => {
  it("classifies photos using image MIME types", () => {
    expect(
      getMediaFileKind(
        mediaFile("photo.bin", "image/jpeg"),
      ),
    ).toBe("photo");
  });

  it("classifies videos using video MIME types", () => {
    expect(
      getMediaFileKind(
        mediaFile("clip.bin", "video/mp4"),
      ),
    ).toBe("video");
  });

  it("recognizes photo extensions when MIME type is missing", () => {
    expect(
      getMediaFileKind(mediaFile("HOLIDAY.JPEG")),
    ).toBe("photo");
  });

  it("recognizes video extensions with a generic MIME type", () => {
    expect(
      getMediaFileKind(
        mediaFile(
          "clip.MOV",
          "application/octet-stream",
        ),
      ),
    ).toBe("video");
  });

  it("does not classify PDF documents as media", () => {
    expect(
      getMediaFileKind(
        mediaFile("notes.pdf", "application/pdf"),
      ),
    ).toBe("unsupported");
  });

  it("filters mixed selections and preserves their order", () => {
    const photo = mediaFile("photo.jpg", "image/jpeg");
    const document = mediaFile(
      "notes.pdf",
      "application/pdf",
    );
    const video = mediaFile("clip.mp4", "video/mp4");

    expect(
      filterMediaFiles([photo, document, video]),
    ).toEqual([photo, video]);
  });

  it("returns an empty array when no media files are selected", () => {
    expect(
      filterMediaFiles([
        mediaFile("notes.txt", "text/plain"),
      ]),
    ).toEqual([]);
  });
});

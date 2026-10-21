import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { newChatClientId } from "./chatActions";
import { validateChatImages } from "./chatPresentation";
import type { ChatPickedImage } from "./types";

export async function pickChatImages(
  source: "camera" | "library",
  remaining: number,
): Promise<ChatPickedImage[]> {
  if (remaining <= 0) throw new Error("Mỗi tin nhắn chỉ gửi tối đa 4 ảnh.");
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Cho phép MoveVN dùng máy ảnh trong Cài đặt để chụp ảnh.",
      );
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: remaining,
          quality: 0.85,
        });
  if (result.canceled) return [];
  const images = result.assets.map((asset) => {
    const extension =
      asset.fileName?.split(".").at(-1)?.toLowerCase() ??
      asset.uri.split("?")[0]?.split(".").at(-1)?.toLowerCase();
    const type =
      asset.mimeType ??
      {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      }[extension ?? ""] ??
      "";
    const size = asset.fileSize ?? asset.file?.size ?? new File(asset.uri).size;
    return {
      id: newChatClientId(),
      uri: asset.uri,
      name:
        asset.fileName ||
        `photo.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`,
      type,
      size,
      file: asset.file,
    };
  });
  if (images.length > remaining)
    throw new Error("Mỗi tin nhắn chỉ gửi tối đa 4 ảnh.");
  const error = validateChatImages(images);
  if (error) throw new Error(error);
  return images;
}

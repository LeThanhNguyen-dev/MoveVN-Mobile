export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

export type UploadFileInput = UploadFile | Blob;

export function isUploadFileInput(value: unknown): value is UploadFileInput {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UploadFile>;
  return typeof candidate.uri === "string" && typeof candidate.name === "string" && typeof candidate.type === "string";
}

export function appendUploadFile(formData: FormData, fieldName: string, file: UploadFileInput) {
  formData.append(fieldName, file as unknown as Blob);
}

export type PrepareHospitalOnboardingUploadInput = {
  fileName: string;
  contentType: string;
};

export type PrepareHospitalOnboardingUploadResult = {
  bucket: string;
  filePath: string;
  token: string;
};

export type CompleteHospitalOnboardingUploadInput = {
  title: string;
  tag: string;
  bucket: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  sortOrder: number;
};

export type DirectUploadPrepareResult = {
  bucket: string;
  filePath: string;
  token: string;
};

export type DirectUploadHooks<TCompleteInput> = {
  file: File;
  prepareUpload: () => Promise<DirectUploadPrepareResult>;
  buildCompleteInput: (prepared: {
    bucket: string;
    filePath: string;
  }) => TCompleteInput;
  completeUpload: (input: TCompleteInput) => Promise<void>;
};

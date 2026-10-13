export type PinDocumentType = "CCCD" | "GPLX";

export type PinVehicleType = "Motorbike" | "Car";

export type PinStatusResponse = {
  isPinSet: boolean;
  failedPinAttempts: number;
  pinLockoutEnd: string | null;
  lockoutRemainingSeconds: number | null;
};

export type PinSetupRequest = {
  pinCode: string;
  otp: string;
};

export type PinChangeRequest = {
  currentPinCode: string;
  newPinCode: string;
};

export type PinVerifyViewDocumentRequest = {
  pinCode: string;
  documentType: PinDocumentType;
  vehicleType?: PinVehicleType;
};

export type ViewDocumentPlaintextResponse = {
  documentNumber: string;
  documentType: PinDocumentType;
};

export type PinForgotResetRequest = {
  email: string;
  otpCode: string;
  newPinCode: string;
};

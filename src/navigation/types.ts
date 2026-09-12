export type AuthStackParamList = {
  Login: { notice?: string } | undefined;
  Register: undefined;
  OwnerRegister: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  VerifyEmail: { email: string; purpose: "Register" | "VerifyEmail" };
};

export type ExploreStackParamList = {
  ExploreMain: undefined;
  VehicleList: {
    type: "Car" | "Motorbike" | "";
    province: string;
    district: string;
    areaId?: number;
    startDate: string;
    endDate: string;
  };
  VehicleDetail: {
    vehicleId: number;
    startDate?: string;
    endDate?: string;
  };
};

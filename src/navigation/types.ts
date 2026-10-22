export type AuthStackParamList = {
  Login: { notice?: string } | undefined;
  Register: undefined;
  OwnerRegister: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  VerifyEmail: { email: string; purpose: "Register" | "VerifyEmail" };
  Policies: { slug?: string } | undefined;
};

export type ExploreStackParamList = {
  ExploreMain: undefined;
  FavoriteVehicles: undefined;
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
  CreateBooking: {
    vehicleId: number;
    startDate?: string;
    endDate?: string;
    promoCode?: string;
    pickupAddress?: string;
    returnAddress?: string;
    customerNote?: string;
  };
};

export type DealsStackParamList = {
  Promotions: undefined;
  VoucherHunt: { promotionId?: number } | undefined;
  VoucherWallet: undefined;
};

export type TripsStackParamList = {
  TripList: undefined;
  TripDetail: {
    bookingId: number;
  };
  TripHandover: { bookingId: number; inspectionType: "CheckIn" | "CheckOut" };
  BookingWallet: undefined;
  VehicleDetail: { vehicleId: number; startDate?: string; endDate?: string };
  BookingUserProfile: { userId: number };
  BookingChat: { bookingId: number };
};

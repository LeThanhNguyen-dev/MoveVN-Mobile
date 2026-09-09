import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import RegistrationScreen from "./RegistrationScreen";
import type { AuthStackParamList } from "@/navigation/types";

export default function OwnerRegisterScreen(props: NativeStackScreenProps<AuthStackParamList, "OwnerRegister">) { return <RegistrationScreen {...props} />; }

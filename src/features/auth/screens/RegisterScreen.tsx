import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import RegistrationScreen from "./RegistrationScreen";
import type { AuthStackParamList } from "@/navigation/types";

export default function RegisterScreen(props: NativeStackScreenProps<AuthStackParamList, "Register">) { return <RegistrationScreen {...props} />; }

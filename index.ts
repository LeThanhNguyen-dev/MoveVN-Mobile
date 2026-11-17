import "react-native-gesture-handler";
// Task GPS nền phải được define ở module scope trước khi app đăng ký,
// kể cả khi Android khởi động app ở chế độ headless (không mở UI).
import "./src/features/gps/backgroundLocationTask";
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

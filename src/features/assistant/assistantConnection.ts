import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

import { getApiBaseUrl } from "@/services/apiClient";
import { getToken } from "@/features/auth/hooks/useAuth";

// Port từ FrontEnd assistantConnection.ts sang mobile.
// Mobile dùng SecureStore token (string), apiClient tự gắn Bearer nên
// SignalR cũng lấy token theo cách mobile.
export function subscribeAssistant(
  onUpdate: (event: { conversationId: string; status: string }) => void,
  onConnection: (connected: boolean) => void,
) {
  let disposed = false;
  const connection = new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}/hubs/chat`, { accessTokenFactory: () => getToken() ?? "" })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Error)
    .build();
  connection.on("AssistantUpdated", onUpdate);
  connection.onreconnecting(() => onConnection(false));
  connection.onreconnected(() => onConnection(true));
  connection.onclose(() => {
    if (!disposed) onConnection(false);
  });
  void connection
    .start()
    .then(() => {
      if (disposed) void connection.stop();
      else onConnection(true);
    })
    .catch(() => {
      if (!disposed) onConnection(false);
    });
  return () => {
    disposed = true;
    connection.off("AssistantUpdated", onUpdate);
    void connection.stop();
  };
}

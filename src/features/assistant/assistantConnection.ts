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
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const connection = new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}/hubs/chat`, { accessTokenFactory: () => getToken() ?? "" })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.Error)
    .build();
  connection.on("AssistantUpdated", onUpdate);
  connection.onreconnecting(() => onConnection(false));
  connection.onreconnected(() => onConnection(true));
  function start() {
    if (disposed) return;
    void connection.start().then(() => {
      attempts = 0;
      if (disposed) void connection.stop(); else onConnection(true);
    }).catch(() => {
      if (disposed) return;
      onConnection(false);
      if (attempts < 5) retryTimer = setTimeout(start, Math.min(15000, 1000 * 2 ** attempts++));
    });
  }
  connection.onclose(() => {
    if (!disposed) { onConnection(false); if (attempts < 5) retryTimer = setTimeout(start, Math.min(15000, 1000 * 2 ** attempts++)); }
  });
  start();
  return () => { disposed = true; clearTimeout(retryTimer); connection.off("AssistantUpdated", onUpdate); void connection.stop(); };
}

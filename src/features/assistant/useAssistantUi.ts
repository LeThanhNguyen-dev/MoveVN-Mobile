import { create } from "zustand";

interface AssistantUiState {
  /** Modal chat mở hay không (điều khiển từ FAB hoặc Trung tâm hỗ trợ). */
  chatOpen: boolean;
  /** Người dùng đã ẩn nút tròn nổi (vì che giao diện) hay chưa. */
  fabHidden: boolean;
  setChatOpen: (open: boolean) => void;
  setFabHidden: (hidden: boolean) => void;
}

// Store chung để nút FAB nổi và thẻ "Chatbot MoveVN" trong Trung tâm hỗ trợ
// cùng mở/tắt một modal chat duy nhất.
export const useAssistantUi = create<AssistantUiState>((set) => ({
  chatOpen: false,
  fabHidden: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setFabHidden: (fabHidden) => set({ fabHidden }),
}));

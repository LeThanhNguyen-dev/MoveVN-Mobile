export interface SupportTicketListRequest {
  bookingId?: number;
  category?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  priority?: string;
  status?: string;
}

export interface CreateSupportTicketRequest {
  bookingId?: number;
  category: string;
  subject: string;
  message: string;
  priority: string;
  attachmentUrls?: string;
}

export interface AddTicketMessageRequest {
  message: string;
  attachmentUrls?: string;
}

export interface UpdateSupportTicketStatusRequest {
  status: string;
}

export interface SupportTicketListItem {
  bookingId?: number | null;
  id: number;
  userId: number;
  customerName: string;
  ticketNumber: string;
  category: string;
  subject: string;
  status: string;
  assignedStaffId?: number | null;
  assignedStaffName?: string | null;
  priority: string;
  messageCount: number;
  lastMessageAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface TicketMessageResponse {
  id: number;
  ticketId: number;
  senderId: number;
  senderName: string;
  senderRoles: string[];
  message: string;
  attachmentUrls?: string | null;
  createdAt: string;
}

export interface SupportTicketDetailResponse extends SupportTicketListItem {
  messages: TicketMessageResponse[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export type TicketFeedback = { id: string; cycleNumber: number; rating: number; comment: string; createdAt: string };
export type TicketSlaCycle = { id: string; number: number; priority: string; startedAt: string; responseDueAt: string; resolutionDueAt: string; firstResponseAt: string | null; resolvedAt: string | null; responseState: string; resolutionState: string; responseMinutes: number | null; resolutionMinutes: number | null };
export type TicketQuality = { ticketId: number; generatedAt: string; tracked: boolean; canRate: boolean; cycles: TicketSlaCycle[]; feedback: TicketFeedback[] };

export type TicketEntry = { ticketId?: number; bookingId?: number; bookingCode?: string; create?: boolean };

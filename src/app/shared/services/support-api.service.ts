import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export type ConversationStatus =
  | 'AI_PROCESSING'
  | 'WAITING_FOR_ADMIN'
  | 'ADMIN_PROCESSING'
  | 'RESOLVED';

export interface ChatMessage {
  _id?: string;
  sender: 'customer' | 'ai' | 'admin';
  senderName?: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isRead?: boolean;
}

export interface SupportConversation {
  _id: string;
  sessionId: string;
  customer?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: ConversationStatus;
  lastMessage?: string;
  lastMessageAt: string;
  unreadAdminCount: number;
  unreadCustomerCount: number;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  relatedOrder?: {
    _id: string;
    orderCode: string;
    total: number;
    status: string;
  };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportStats {
  total: number;
  waitingForAdmin: number;
  adminProcessing: number;
  aiProcessing: number;
  resolved: number;
}

@Injectable({ providedIn: 'root' })
export class SupportApiService {
  private api = inject(ApiService);

  getConversations(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: SupportConversation[];
      stats: SupportStats;
      total: number;
    }>('/support/conversations', params);
  }

  getConversationById(id: string) {
    return this.api.get<{
      success: boolean;
      data: SupportConversation;
    }>(`/support/conversations/${id}`);
  }

  assignToMe(id: string) {
    return this.api.post<{
      success: boolean;
      data: SupportConversation;
    }>(`/support/conversations/${id}/assign`, {});
  }

  sendAdminReply(id: string, content: string) {
    return this.api.post<{
      success: boolean;
      data: SupportConversation;
      message: ChatMessage;
    }>(`/support/conversations/${id}/reply`, { content });
  }

  updateStatus(id: string, status: ConversationStatus) {
    return this.api.put<{
      success: boolean;
      data: SupportConversation;
    }>(`/support/conversations/${id}/status`, { status });
  }

  requestHumanSupport(sessionId: string, customerInfo?: { name?: string; email?: string; phone?: string }) {
    return this.api.post<{
      success: boolean;
      data: SupportConversation;
    }>('/support/request-human', { sessionId, customerInfo });
  }
}


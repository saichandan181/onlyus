import { create } from 'zustand';
import { Message } from '@/services/api';
import {
  saveMessage,
  getMessages,
  deleteMessage as dbDelete,
  addReaction as dbReact,
  updateMessageStatus as dbUpdateMessageStatus,
} from '@/services/database';

interface ChatState {
  messages: Message[];
  /** 0–1 while sending media (read + encrypt + socket chunks). */
  uploadProgressByMessageId: Record<string, number>;
  isTyping: boolean;
  partnerMood: string | null;
  isPartnerOnline: boolean;
  isConnected: boolean;
  unreadCount: number;

  // Actions
  loadMessages: () => Promise<void>;
  addMessage: (msg: Message) => Promise<void>;
  removeMessage: (msgId: string) => void;
  setMessageUploadProgress: (msgId: string, progress: number) => void;
  clearMessageUploadProgress: (msgId: string) => void;
  addReactionToMessage: (msgId: string, reaction: string) => void;
  setTyping: (typing: boolean) => void;
  setPartnerMood: (mood: string | null) => void;
  setPartnerOnline: (online: boolean) => void;
  setConnected: (connected: boolean) => void;
  markAllRead: () => void;
  clearMessages: () => void;
  updateMessageStatus: (msgId: string, status: Message['status']) => void;
  mergeMessage: (msgId: string, patch: Partial<Message>) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  uploadProgressByMessageId: {},
  isTyping: false,
  partnerMood: null,
  isPartnerOnline: false,
  isConnected: false,
  unreadCount: 0,

  loadMessages: async () => {
    try {
      const msgs = await getMessages(100);
      set({ messages: msgs.reverse() }); // Oldest first for display
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  },

  addMessage: async (msg: Message) => {
    set(state => {
      const i = state.messages.findIndex(m => m.id === msg.id);
      if (i >= 0) {
        const next = [...state.messages];
        next[i] = { ...next[i], ...msg };
        return { messages: next };
      }
      return { messages: [...state.messages, msg] };
    });
    try {
      await saveMessage(msg);
    } catch (e) {
      console.error('saveMessage failed', e);
    }
  },

  removeMessage: (msgId: string) => {
    dbDelete(msgId);
    set(state => {
      const uploadProgressByMessageId = { ...state.uploadProgressByMessageId };
      delete uploadProgressByMessageId[msgId];
      return {
        messages: state.messages.filter(m => m.id !== msgId),
        uploadProgressByMessageId,
      };
    });
  },

  setMessageUploadProgress: (msgId: string, progress: number) => {
    const p = Math.min(1, Math.max(0, progress));
    set(state => ({
      uploadProgressByMessageId: { ...state.uploadProgressByMessageId, [msgId]: p },
    }));
  },

  clearMessageUploadProgress: (msgId: string) => {
    set(state => {
      const uploadProgressByMessageId = { ...state.uploadProgressByMessageId };
      delete uploadProgressByMessageId[msgId];
      return { uploadProgressByMessageId };
    });
  },

  addReactionToMessage: (msgId: string, reaction: string) => {
    dbReact(msgId, reaction);
    set(state => ({
      messages: state.messages.map(m => {
        if (m.id === msgId) {
          let reactions: string[] = [];
          try { reactions = JSON.parse(m.reactions); } catch {}
          if (!reactions.includes(reaction)) {
            reactions.push(reaction);
          }
          return { ...m, reactions: JSON.stringify(reactions) };
        }
        return m;
      }),
    }));
  },

  setTyping: (typing: boolean) => set({ isTyping: typing }),
  setPartnerMood: (mood: string | null) => set({ partnerMood: mood }),
  setPartnerOnline: (online: boolean) => set({ isPartnerOnline: online }),
  setConnected: (connected: boolean) => set({ isConnected: connected }),
  markAllRead: () => set({ unreadCount: 0 }),
  clearMessages: () => set({ messages: [], uploadProgressByMessageId: {} }),
  updateMessageStatus: (msgId: string, status: Message['status']) => {
    void dbUpdateMessageStatus(msgId, status);
    set(state => ({
      messages: state.messages.map(m =>
        m.id === msgId ? { ...m, status } : m
      ),
    }));
  },

  mergeMessage: (msgId: string, patch: Partial<Message>) => {
    set(state => {
      const m = state.messages.find(x => x.id === msgId);
      if (!m) return state;
      const next = { ...m, ...patch };
      void saveMessage(next);
      return { messages: state.messages.map(x => (x.id === msgId ? next : x)) };
    });
  },
}));

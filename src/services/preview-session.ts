import { PreviewSession, PreviewItem } from '../types/elabftw';

const STORAGE_KEY = 'elabftw_preview_sessions';
const MAX_SESSIONS = 10;

export class PreviewSessionService {
  static saveSession(session: PreviewSession): void {
    try {
      const sessions = this.getAllSessions();
      
      // Remove existing session with same ID
      const filteredSessions = sessions.filter(s => s.id !== session.id);
      
      // Add new session at the beginning
      filteredSessions.unshift(session);
      
      // Keep only the most recent sessions
      const trimmedSessions = filteredSessions.slice(0, MAX_SESSIONS);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedSessions));
    } catch (error) {
      console.error('Failed to save preview session:', error);
    }
  }

  static getSession(sessionId: string): PreviewSession | null {
    try {
      const sessions = this.getAllSessions();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('Failed to get preview session:', error);
      return null;
    }
  }

  static getAllSessions(): PreviewSession[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get preview sessions:', error);
      return [];
    }
  }

  static deleteSession(sessionId: string): void {
    try {
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSessions));
    } catch (error) {
      console.error('Failed to delete preview session:', error);
    }
  }

  static updateItemClassification(sessionId: string, itemId: string, classification: 'document' | 'inventory'): void {
    try {
      const session = this.getSession(sessionId);
      if (!session) return;

      const item = session.items.find(i => i.id === itemId);
      if (!item) return;

      item.userClassification = classification;
      this.saveSession(session);
    } catch (error) {
      console.error('Failed to update item classification:', error);
    }
  }

  static clearAllSessions(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear preview sessions:', error);
    }
  }
}
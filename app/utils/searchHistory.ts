import { storageCache } from './storageCache';

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultCount?: number;
}

const SEARCH_HISTORY_KEY = '@syncvibe/search_history';
const MAX_HISTORY_ITEMS = 20;
const MIN_QUERY_LENGTH = 2;

class SearchHistoryManager {
  private static instance: SearchHistoryManager;
  private cache: SearchHistoryItem[] | null = null;

  private constructor() {}

  public static getInstance(): SearchHistoryManager {
    if (!SearchHistoryManager.instance) {
      SearchHistoryManager.instance = new SearchHistoryManager();
    }
    return SearchHistoryManager.instance;
  }

  /**
   * Get search history with optional filtering
   */
  public async getHistory(filter?: string): Promise<SearchHistoryItem[]> {
    try {
      if (!this.cache) {
        const data = await storageCache.getItem(SEARCH_HISTORY_KEY);
        this.cache = data ? JSON.parse(data) : [];
      }

      let history = [...(this.cache || [])];

      // Filter history if a filter is provided
      if (filter && filter.trim().length > 0) {
        const filterLower = filter.toLowerCase().trim();
        history = history.filter((item) => item.query.toLowerCase().includes(filterLower));
      }

      // Sort by timestamp (most recent first)
      return history.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }

  /**
   * Add a search query to history when user actually interacts with results
   * Smart logic: only add if query is meaningful and user clicked on a song
   */
  public async addToHistoryOnSongClick(query: string): Promise<void> {
    try {
      const trimmedQuery = query.trim();

      // Don't add empty or too short queries
      if (!trimmedQuery || trimmedQuery.length < MIN_QUERY_LENGTH) {
        return;
      }

      const history = await this.getHistory();

      // Check if this exact query already exists
      const existingIndex = history.findIndex(
        (item) => item.query.toLowerCase() === trimmedQuery.toLowerCase()
      );

      if (existingIndex !== -1) {
        // Update existing item with new timestamp
        history[existingIndex] = {
          ...history[existingIndex],
          timestamp: Date.now(),
        };
      } else {
        // Add new item
        const newItem: SearchHistoryItem = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          query: trimmedQuery,
          timestamp: Date.now(),
        };

        history.unshift(newItem);
      }

      // Limit history size
      const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);

      // Update cache and storage
      this.cache = limitedHistory;
      await storageCache.setItem(SEARCH_HISTORY_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
      console.error('Error adding to search history:', error);
    }
  }

  /**
   * Remove a specific search history item
   */
  public async removeHistoryItem(id: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const filteredHistory = history.filter((item) => item.id !== id);

      this.cache = filteredHistory;
      await storageCache.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
      console.error('Error removing history item:', error);
    }
  }

  /**
   * Clear all search history
   */
  public async clearHistory(): Promise<void> {
    try {
      this.cache = [];
      await storageCache.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }

  /**
   * Get recent searches (excluding the current query to avoid duplicates)
   */
  public async getRecentSearches(
    excludeQuery?: string,
    limit: number = 10
  ): Promise<SearchHistoryItem[]> {
    try {
      const history = await this.getHistory();

      let filtered = history;
      if (excludeQuery) {
        const excludeLower = excludeQuery.toLowerCase().trim();
        filtered = history.filter((item) => item.query.toLowerCase() !== excludeLower);
      }

      return filtered.slice(0, limit);
    } catch (error) {
      console.error('Error getting recent searches:', error);
      return [];
    }
  }
}

export const searchHistoryManager = SearchHistoryManager.getInstance();
export type { SearchHistoryItem };

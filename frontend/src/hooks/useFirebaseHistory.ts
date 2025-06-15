// frontend/src/hooks/useFirebaseHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { firestoreService } from '../services/firebase/firestoreService';
import type { AnalysisEntry } from '../services/firebase/firestoreService';
import { useAuth } from './useAuth';

interface UseFirebaseHistoryReturn {
  history: AnalysisEntry[];
  statistics: any;
  loading: boolean;
  error: string | null;
  refreshHistory: () => Promise<void>;
  searchHistory: (searchTerm?: string, filterType?: string, sortBy?: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
    clearAllHistory: () => Promise<number | undefined>;
  saveAnalysis: (analysisData: any) => Promise<void>;
}

export const useFirebaseHistory = (): UseFirebaseHistoryReturn => {
  const [history, setHistory] = useState<AnalysisEntry[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();

  // Refresh toàn bộ lịch sử
  const refreshHistory = useCallback(async () => {
    if (!user) {
      setError('Bạn cần đăng nhập để xem lịch sử');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const [historyData, statsData] = await Promise.all([
        firestoreService.getUserHistory(user.uid, 100),
        firestoreService.getUserStatistics(user.uid)
      ]);
      
      setHistory(historyData);
      setStatistics(statsData);
    } catch (err) {
      setError('Lỗi khi tải lịch sử từ Firebase');
      console.error('Error refreshing history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Search với filter
  const searchHistory = useCallback(async (
    searchTerm?: string, 
    filterType?: string, 
    sortBy?: string
  ) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const results = await firestoreService.searchUserHistory(
        user.uid,
        searchTerm,
        filterType,
        sortBy,
        100
      );
      
      setHistory(results);
    } catch (err) {
      setError('Lỗi khi tìm kiếm');
      console.error('Error searching history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Delete một item
  const deleteItem = useCallback(async (itemId: string) => {
    if (!user) return;

    try {
      await firestoreService.deleteAnalysis(user.uid, itemId);
      
      // Update local state
      setHistory(prev => prev.filter(item => item.id !== itemId));
      
      // Update statistics
      if (statistics) {
        const deletedItem = history.find(item => item.id === itemId);
        if (deletedItem) {
          setStatistics((prev: any) => ({
            ...prev,
            total: prev.total - 1,
            fakeCount: deletedItem.result.isFakeNews ? prev.fakeCount - 1 : prev.fakeCount,
            realCount: !deletedItem.result.isFakeNews ? prev.realCount - 1 : prev.realCount
          }));
        }
      }
    } catch (err) {
      setError('Lỗi khi xóa mục');
      console.error('Error deleting item:', err);
      throw err; // Re-throw để component có thể handle
    }
  }, [user, history, statistics]);

  // Clear toàn bộ lịch sử
  const clearAllHistory = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const deletedCount = await firestoreService.clearUserHistory(user.uid);
      
      setHistory([]);
      setStatistics((prev: any) => ({
        ...prev,
        total: 0,
        fakeCount: 0,
        realCount: 0,
        urlAnalyses: 0,
        textAnalyses: 0,
        twoStepAnalyses: 0
      }));
      
      return deletedCount;
    } catch (err) {
      setError('Lỗi khi xóa lịch sử');
      console.error('Error clearing history:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Save analysis mới
  const saveAnalysis = useCallback(async (analysisData: {
    text: string;
    result: any;
    sourcesAnalyzed: number;
    analysisType: string;
    originalUrl?: string;
    twoStepProcess?: boolean;
  }) => {
    if (!user) return;

    try {
      const docId = await firestoreService.saveAnalysis(user, analysisData);
      
      // Thêm vào local state
      const newEntry: AnalysisEntry = {
        id: docId,
        text: analysisData.text,
        result: analysisData.result,
        sourcesAnalyzed: analysisData.sourcesAnalyzed,
        analysisType: analysisData.analysisType,
        timestamp: new Date().toISOString(),
        originalUrl: analysisData.originalUrl,
        twoStepProcess: analysisData.twoStepProcess,
        userId: user.uid,
        userEmail: user.email || ''
      };
      
      setHistory(prev => [newEntry, ...prev]);
      
      // Update statistics
      setStatistics((prev: any) => ({
        ...prev,
        total: (prev?.total || 0) + 1,
        fakeCount: analysisData.result.isFakeNews ? (prev?.fakeCount || 0) + 1 : (prev?.fakeCount || 0),
        realCount: !analysisData.result.isFakeNews ? (prev?.realCount || 0) + 1 : (prev?.realCount || 0),
        urlAnalyses: analysisData.originalUrl ? (prev?.urlAnalyses || 0) + 1 : (prev?.urlAnalyses || 0),
        twoStepAnalyses: analysisData.twoStepProcess ? (prev?.twoStepAnalyses || 0) + 1 : (prev?.twoStepAnalyses || 0),
        todayCount: (prev?.todayCount || 0) + 1
      }));
      
    } catch (err) {
      console.error('Error saving analysis:', err);
      throw err;
    }
  }, [user]);

  // Load initial data khi user thay đổi
  useEffect(() => {
    if (user) {
      refreshHistory();
    } else {
      setHistory([]);
      setStatistics(null);
      setError(null);
    }
  }, [user, refreshHistory]);

  return {
    history,
    statistics,
    loading,
    error,
    refreshHistory,
    searchHistory,
    deleteItem,
    clearAllHistory,
    saveAnalysis
  };
};
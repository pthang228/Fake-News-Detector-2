// backend/src/services/history.service.ts
// 📊 Service quản lý lịch sử phân tích

import { HistoryEntry } from '../types/interfaces';

class HistoryService {
  private analysisHistory: HistoryEntry[] = [];
  private readonly MAX_HISTORY_ITEMS = 100;

  /**
   * Thêm một mục mới vào lịch sử
   */
  addToHistory(entry: Omit<HistoryEntry, 'id'>): HistoryEntry {
    const historyEntry: HistoryEntry = {
      id: Date.now(), // ID đơn giản dựa trên timestamp
      ...entry
    };

    // Thêm vào đầu mảng lịch sử
    this.analysisHistory.unshift(historyEntry);

    // Chỉ giữ số lượng mục tối đa để tránh vấn đề bộ nhớ
    if (this.analysisHistory.length > this.MAX_HISTORY_ITEMS) {
      this.analysisHistory = this.analysisHistory.slice(0, this.MAX_HISTORY_ITEMS);
    }

    console.log(`📊 Đã lưu vào lịch sử: ${historyEntry.analysisType} - Tổng mục: ${this.analysisHistory.length}`);
    
    return historyEntry;
  }

  /**
   * Lấy tất cả lịch sử
   */
  getAllHistory(): HistoryEntry[] {
    return this.analysisHistory;
  }

  /**
   * Lấy số lượng mục trong lịch sử
   */
  getHistoryCount(): number {
    return this.analysisHistory.length;
  }

  /**
   * Xóa tất cả lịch sử
   */
  clearAllHistory(): number {
    const deletedCount = this.analysisHistory.length;
    this.analysisHistory = [];
    return deletedCount;
  }

  /**
   * Xóa một mục lịch sử theo ID
   */
  deleteHistoryItem(itemId: number): boolean {
    const initialLength = this.analysisHistory.length;
    this.analysisHistory = this.analysisHistory.filter(item => item.id !== itemId);
    return this.analysisHistory.length < initialLength;
  }

  /**
   * Tìm mục lịch sử theo ID
   */
  findHistoryItemById(itemId: number): HistoryEntry | undefined {
    return this.analysisHistory.find(item => item.id === itemId);
  }

  /**
   * Lấy thống kê lịch sử
   */
  getHistoryStatistics() {
    const total = this.analysisHistory.length;
    
    if (total === 0) {
      return {
        total: 0,
        fakeCount: 0,
        realCount: 0,
        urlAnalyses: 0,
        textAnalyses: 0,
        twoStepAnalyses: 0,
        avgConfidence: 0,
        timeStats: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0
        }
      };
    }
    
    // Tính toán thống kê
    const fakeCount = this.analysisHistory.filter(item => item.result.isFakeNews).length;
    const realCount = total - fakeCount;
    const urlAnalyses = this.analysisHistory.filter(item => item.analysisType.includes('URL')).length;
    const textAnalyses = total - urlAnalyses;
    const twoStepAnalyses = this.analysisHistory.filter(item => item.twoStepProcess).length;
    
    const avgConfidence = Math.round(
      this.analysisHistory.reduce((sum, item) => sum + item.result.confidence, 0) / total
    );
    
    // Thống kê theo thời gian
    const now = new Date();
    const today = now.toDateString();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayCount = this.analysisHistory.filter(item => 
      new Date(item.timestamp).toDateString() === today
    ).length;
    
    const weekCount = this.analysisHistory.filter(item => 
      new Date(item.timestamp) >= oneWeekAgo
    ).length;
    
    const monthCount = this.analysisHistory.filter(item => 
      new Date(item.timestamp) >= oneMonthAgo
    ).length;
    
    return {
      total,
      fakeCount,
      realCount,
      urlAnalyses,
      textAnalyses,
      twoStepAnalyses,
      avgConfidence,
      timeStats: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount
      }
    };
  }

  /**
   * Tìm kiếm trong lịch sử
   */
  searchHistory(searchTerm: string): HistoryEntry[] {
    if (!searchTerm.trim()) {
      return this.analysisHistory;
    }

    const term = searchTerm.toLowerCase();
    return this.analysisHistory.filter(item => 
      item.text.toLowerCase().includes(term) ||
      item.result.reason.toLowerCase().includes(term) ||
      item.analysisType.toLowerCase().includes(term) ||
      (item.identifiedTitle && item.identifiedTitle.toLowerCase().includes(term)) ||
      (item.originalUrl && item.originalUrl.toLowerCase().includes(term))
    );
  }

  /**
   * Lọc lịch sử theo loại phân tích
   */
  filterByAnalysisType(analysisType: string): HistoryEntry[] {
    if (!analysisType || analysisType === 'all') {
      return this.analysisHistory;
    }

    return this.analysisHistory.filter(item => 
      item.analysisType.toLowerCase().includes(analysisType.toLowerCase())
    );
  }

  /**
   * Lọc lịch sử theo kết quả (fake/real)
   */
  filterByResult(isFakeNews: boolean | null): HistoryEntry[] {
    if (isFakeNews === null) {
      return this.analysisHistory;
    }

    return this.analysisHistory.filter(item => 
      item.result.isFakeNews === isFakeNews
    );
  }

  /**
   * Sắp xếp lịch sử
   */
  sortHistory(sortBy: 'timestamp' | 'confidence' | 'analysisType', order: 'asc' | 'desc' = 'desc'): HistoryEntry[] {
    const sorted = [...this.analysisHistory].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'confidence':
          comparison = a.result.confidence - b.result.confidence;
          break;
        case 'analysisType':
          comparison = a.analysisType.localeCompare(b.analysisType);
          break;
        default:
          comparison = 0;
      }
      
      return order === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }

  /**
   * Lấy lịch sử với phân trang
   */
  getPaginatedHistory(page: number = 1, pageSize: number = 10): {
    data: HistoryEntry[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const data = this.analysisHistory.slice(startIndex, endIndex);
    const totalItems = this.analysisHistory.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return {
      data,
      totalItems,
      totalPages,
      currentPage: page,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  /**
   * Export lịch sử ra JSON
   */
  exportHistory(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalItems: this.analysisHistory.length,
      data: this.analysisHistory
    }, null, 2);
  }

  /**
   * Import lịch sử từ JSON
   */
  importHistory(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    try {
      const parsed = JSON.parse(jsonData);
      const errors: string[] = [];
      let imported = 0;

      if (!parsed.data || !Array.isArray(parsed.data)) {
        return { success: false, imported: 0, errors: ['Dữ liệu không hợp lệ'] };
      }

      for (const item of parsed.data) {
        try {
          // Validate item structure
          if (this.isValidHistoryEntry(item)) {
            this.addToHistory(item);
            imported++;
          } else {
            errors.push(`Mục không hợp lệ: ${item.id || 'unknown'}`);
          }
        } catch (error) {
          errors.push(`Lỗi import mục: ${error}`);
        }
      }

      return { success: imported > 0, imported, errors };
    } catch (error) {
      return { success: false, imported: 0, errors: [`Lỗi parse JSON: ${error}`] };
    }
  }

  /**
   * Validate cấu trúc HistoryEntry
   */
  private isValidHistoryEntry(item: any): boolean {
    return (
      typeof item === 'object' &&
      typeof item.text === 'string' &&
      typeof item.result === 'object' &&
      typeof item.result.isFakeNews === 'boolean' &&
      typeof item.result.confidence === 'number' &&
      typeof item.analysisType === 'string' &&
      typeof item.timestamp === 'string'
    );
  }
}

// Singleton instance
export const historyService = new HistoryService();
export default historyService;
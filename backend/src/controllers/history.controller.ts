// backend/src/controllers/history.controller.ts
// 📊 Controller quản lý các endpoint lịch sử

import { Request, Response } from 'express';
import historyService from '../services/history.service';

export class HistoryController {
  /**
   * Lấy tất cả lịch sử
   * GET /api/history
   */
  async getAllHistory(req: Request, res: Response): Promise<void> {
    try {
      const { search, filter, sortBy, order, page, pageSize } = req.query;

      let history = historyService.getAllHistory();

      // Áp dụng tìm kiếm nếu có
      if (search && typeof search === 'string') {
        history = historyService.searchHistory(search);
      }

      // Áp dụng filter nếu có
      if (filter && typeof filter === 'string') {
        if (filter === 'fake') {
          history = history.filter(item => item.result.isFakeNews);
        } else if (filter === 'real') {
          history = history.filter(item => !item.result.isFakeNews);
        } else if (filter !== 'all') {
          history = historyService.filterByAnalysisType(filter);
        }
      }

      // Áp dụng sắp xếp nếu có
      if (sortBy && typeof sortBy === 'string') {
        const sortOrder = order === 'asc' ? 'asc' : 'desc';
        if (['timestamp', 'confidence', 'analysisType'].includes(sortBy)) {
          history = [...history].sort((a, b) => {
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
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
          });
        }
      }

      // Áp dụng phân trang nếu có
      if (page && pageSize) {
        const pageNum = parseInt(page as string) || 1;
        const size = parseInt(pageSize as string) || 10;
        const startIndex = (pageNum - 1) * size;
        const endIndex = startIndex + size;
        const paginatedData = history.slice(startIndex, endIndex);
        const totalPages = Math.ceil(history.length / size);

        res.json({
          success: true,
          history: paginatedData,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: history.length,
            pageSize: size,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        });
        return;
      }

      res.json({
        success: true,
        history,
        count: history.length
      });
    } catch (error) {
      console.error("❌ Lỗi lấy lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy lịch sử"
      });
    }
  }

  /**
   * Xóa tất cả lịch sử
   * DELETE /api/history
   */
  async clearAllHistory(req: Request, res: Response): Promise<void> {
    try {
      const deletedCount = historyService.clearAllHistory();
      
      res.json({
        success: true,
        message: `Đã xóa thành công ${deletedCount} mục lịch sử`,
        deletedCount: deletedCount
      });
    } catch (error) {
      console.error("❌ Lỗi xóa lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể xóa lịch sử"
      });
    }
  }

  /**
   * Xóa mục lịch sử cụ thể
   * DELETE /api/history/:id
   */
  async deleteHistoryItem(req: Request, res: Response): Promise<void> {
    try {
      const itemId = parseInt(req.params.id);
      
      if (!itemId || isNaN(itemId)) {
        res.status(400).json({
          success: false,
          error: "ID không hợp lệ - phải là số"
        });
        return;
      }

      const deleted = historyService.deleteHistoryItem(itemId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: "Không tìm thấy mục với ID này"
        });
        return;
      }
      
      res.json({
        success: true,
        message: "Đã xóa mục lịch sử thành công",
        deletedId: itemId,
        remainingCount: historyService.getHistoryCount()
      });
    } catch (error) {
      console.error("❌ Lỗi xóa mục lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể xóa mục lịch sử"
      });
    }
  }

  /**
   * Lấy thống kê lịch sử
   * GET /api/history/stats
   */
  async getHistoryStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = historyService.getHistoryStatistics();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error("❌ Lỗi tính toán thống kê:", error);
      res.status(500).json({
        success: false,
        error: "Không thể tính toán thống kê"
      });
    }
  }

  /**
   * Tìm kiếm trong lịch sử
   * GET /api/history/search
   */
  async searchHistory(req: Request, res: Response): Promise<void> {
    try {
      const { q, type, result } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: "Thiếu từ khóa tìm kiếm"
        });
        return;
      }

      let results = historyService.searchHistory(q);

      // Áp dụng filter theo loại nếu có
      if (type && typeof type === 'string' && type !== 'all') {
        results = results.filter(item => 
          item.analysisType.toLowerCase().includes(type.toLowerCase())
        );
      }

      // Áp dụng filter theo kết quả nếu có
      if (result && typeof result === 'string') {
        if (result === 'fake') {
          results = results.filter(item => item.result.isFakeNews);
        } else if (result === 'real') {
          results = results.filter(item => !item.result.isFakeNews);
        }
      }

      res.json({
        success: true,
        results,
        count: results.length,
        searchTerm: q
      });
    } catch (error) {
      console.error("❌ Lỗi tìm kiếm lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể tìm kiếm lịch sử"
      });
    }
  }

  /**
   * Export lịch sử
   * GET /api/history/export
   */
  async exportHistory(req: Request, res: Response): Promise<void> {
    try {
      const exportData = historyService.exportHistory();
      const filename = `history_export_${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      console.error("❌ Lỗi export lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể export lịch sử"
      });
    }
  }

  /**
   * Import lịch sử
   * POST /api/history/import
   */
  async importHistory(req: Request, res: Response): Promise<void> {
    try {
      const { data } = req.body;

      if (!data || typeof data !== 'string') {
        res.status(400).json({
          success: false,
          error: "Thiếu dữ liệu JSON để import"
        });
        return;
      }

      const result = historyService.importHistory(data);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Đã import thành công ${result.imported} mục`,
          imported: result.imported,
          errors: result.errors
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Import thất bại",
          errors: result.errors
        });
      }
    } catch (error) {
      console.error("❌ Lỗi import lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể import lịch sử"
      });
    }
  }

  /**
   * Lấy một mục lịch sử cụ thể
   * GET /api/history/:id
   */
  async getHistoryItem(req: Request, res: Response): Promise<void> {
    try {
      const itemId = parseInt(req.params.id);
      
      if (!itemId || isNaN(itemId)) {
        res.status(400).json({
          success: false,
          error: "ID không hợp lệ - phải là số"
        });
        return;
      }

      const item = historyService.findHistoryItemById(itemId);
      
      if (!item) {
        res.status(404).json({
          success: false,
          error: "Không tìm thấy mục với ID này"
        });
        return;
      }

      res.json({
        success: true,
        item
      });
    } catch (error) {
      console.error("❌ Lỗi lấy mục lịch sử:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy mục lịch sử"
      });
    }
  }
}

// Export instance
export const historyController = new HistoryController();
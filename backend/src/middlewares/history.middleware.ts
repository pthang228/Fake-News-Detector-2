// backend/src/middleware/history.middleware.ts
// 📊 Middleware tự động lưu lịch sử phân tích

import { Request, Response, NextFunction } from 'express';
import historyService from '../services/history.service';
import { HistoryEntry } from '../types/interfaces';

/**
 * Middleware tự động lưu các phân tích thành công vào lịch sử
 * Áp dụng cho endpoint POST /api/analyze
 */
export const autoSaveHistoryMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Chỉ áp dụng cho endpoint phân tích
  if (req.method === 'POST' && req.path === '/api/analyze') {
    const originalJson = res.json;
    
    res.json = function (data: any) {
      // Lưu vào lịch sử nếu phân tích thành công
      if (data.success && data.analysis) {
        try {
          const historyEntry: Omit<HistoryEntry, 'id'> = {
            text: data.originalText,
            result: data.analysis,
            sourcesAnalyzed: data.statistics?.sourcesAnalyzed || 0,
            analysisType: data.twoStepProcess ? 'Phân Tích URL 2 Bước' : 'Phân Tích Văn Bản',
            timestamp: new Date().toISOString()
          };

          // Thêm thông tin cụ thể cho URL nếu có
          if (data.twoStepProcess) {
            historyEntry.originalUrl = data.originalUrl;
            historyEntry.identifiedTitle = data.analysis.identifiedTitle;
            historyEntry.keyTopics = data.analysis.keyTopics;
            historyEntry.twoStepProcess = true;
          }

          // Lưu vào lịch sử
          historyService.addToHistory(historyEntry);

        } catch (error) {
          console.error("❌ Lỗi lưu vào lịch sử:", error);
          // Không làm thất bại request nếu việc lưu lịch sử thất bại
        }
      }
      
      // Gọi phương thức json gốc
      originalJson.call(this, data);
    };
  }
  
  next();
};

/**
 * Middleware log các hoạt động lịch sử
 */
export const historyLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/history')) {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`📊 History API: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
  }
  
  next();
};

/**
 * Middleware validate ID cho các endpoint history
 */
export const validateHistoryIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id) {
    const itemId = parseInt(req.params.id);
    
    if (!itemId || isNaN(itemId)) {
      res.status(400).json({
        success: false,
        error: "ID không hợp lệ - phải là số nguyên"
      });
      return;
    }
    
    // Gắn ID đã validate vào request
    req.params.validatedId = itemId.toString();
  }
  
  next();
};

/**
 * Middleware rate limiting cho history endpoints
 */
export const historyRateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Tạm thời chỉ log, có thể implement rate limiting thực tế sau
  const userIP = req.ip || req.connection.remoteAddress;
  console.log(`📊 History request from: ${userIP} - ${req.method} ${req.path}`);
  
  next();
};

/**
 * Middleware xử lý lỗi cho history endpoints
 */
export const historyErrorHandlerMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Lỗi trong history endpoint:', error);
  
  // Chỉ xử lý lỗi cho history endpoints
  if (req.path.startsWith('/api/history')) {
    res.status(500).json({
      success: false,
      error: 'Lỗi server trong quản lý lịch sử',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
  
  // Chuyển lỗi cho middleware khác
  next(error);
};
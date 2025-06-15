// backend/server.ts
// 🚀 File server chính - gọn gàng và tập trung

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import các service modular của chúng ta
import { analyzeURL } from '../services/urlAnalyzer';
import { analyzeTextWithWebSearch } from '../services/textAnalyzer';
import { isValidURL } from '../services/googleSearch';
import { HistoryEntry, ApiResponse } from '../types/interfaces';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Lưu trữ lịch sử trong bộ nhớ (cân nhắc sử dụng database cho production)
let analysisHistory: HistoryEntry[] = [];

// 🎯 ENDPOINT PHÂN TÍCH CHÍNH
app.post("/api/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { message }: { message: string } = req.body;

    // Xác thực đầu vào
    if (!message || message.trim() === "") {
      res.status(400).json({
        error: "Vui lòng nhập nội dung cần phân tích"
      });
      return;
    }

    console.log("📝 Bắt đầu phân tích:", message.substring(0, 100) + "...");

    // Xác định loại phân tích: URL vs Văn bản
    if (isValidURL(message)) {
      console.log("🔗 Phát hiện URL - sử dụng phân tích URL");
      await handleURLAnalysis(message, res);
    } else {
      console.log("📝 Phát hiện văn bản - sử dụng phân tích văn bản");
      await handleTextAnalysis(message, res);
    }

  } catch (error) {
    console.error("❌ Lỗi phân tích chung:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi phân tích nội dung",
      details: (error as Error).message
    });
  }
});

// 🔗 Xử lý Phân tích URL
async function handleURLAnalysis(url: string, res: Response): Promise<void> {
  try {
    const urlAnalysis = await analyzeURL(url, url);
    
    const responseData: ApiResponse = {
      success: true,
      analysis: urlAnalysis,
      originalText: url,
      twoStepProcess: urlAnalysis.twoStepProcess || false,
      originalUrl: url
    };

    // Thêm thống kê dựa trên loại phân tích
    if (urlAnalysis.twoStepProcess) {
      responseData.statistics = {
        analysisMode: "Phân Tích URL 2 Bước",
        originalUrl: url,
        sourcesAnalyzed: urlAnalysis.sourcesAnalyzed || 0,
        identifiedTitle: urlAnalysis.identifiedTitle || "Không xác định được",
        keyTopics: urlAnalysis.keyTopics || [],
        searchQueries: urlAnalysis.searchQueries || [],
        twoStepEnabled: true
      };
    } else {
      responseData.statistics = {
        analysisMode: urlAnalysis.limitedAnalysis ? "Phân Tích URL Hạn Chế" : "Phân Tích URL Cơ Bản",
        originalUrl: url,
        sourcesAnalyzed: urlAnalysis.sourcesAnalyzed || 0,
        twoStepEnabled: false,
        note: urlAnalysis.reason_limited || "Quy trình 2 bước không khả dụng"
      };
    }

    res.json(responseData);
    
  } catch (error) {
    console.error("❌ Lỗi phân tích URL:", error);
    res.status(500).json({
      error: "Không thể phân tích URL được cung cấp",
      details: (error as Error).message,
      url: url
    });
  }
}

// 📝 Xử lý Phân tích Văn bản
async function handleTextAnalysis(text: string, res: Response): Promise<void> {
  try {
    const textAnalysisResult = await analyzeTextWithWebSearch(text);
    res.json(textAnalysisResult);
  } catch (error) {
    console.error("❌ Lỗi trong phân tích văn bản:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi phân tích văn bản",
      details: (error as Error).message
    });
  }
}

// 🧪 ENDPOINT KIỂM TRA
app.get("/api/test", (req: Request, res: Response): void => {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasGoogle = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
  
  res.json({
    message: "🚀 API Phát Hiện Tin Giả đang hoạt động!",
    status: "khỏe mạnh",
    configuration: {
      geminiAI: hasGemini ? "✅ Đã cấu hình" : "❌ Chưa cấu hình",
      googleSearch: hasGoogle ? "✅ Đã cấu hình" : "❌ Chưa cấu hình"
    },
    features: {
      textAnalysis: "✅ Khả dụng",
      urlAnalysis: hasGoogle ? "✅ Quy Trình 2 Bước Đầy Đủ" : "⚠️ Hạn chế (chỉ AI)",
      webSearch: hasGoogle ? "✅ Đã bật" : "❌ Đã tắt",
      contentFetching: "✅ Đã bật",
      factChecking: "✅ Đã bật"
    },
    analysisCapabilities: {
      basicAI: "Luôn khả dụng",
      webEvidence: hasGoogle ? "Khả dụng với Google API" : "Cần Google API",
      twoStepURL: hasGoogle ? "Khả dụng" : "Cần Google API",
      contentExtraction: "Luôn khả dụng"
    },
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// 📊 CÁC ENDPOINT QUẢN LÝ LỊCH SỬ

// Lấy tất cả lịch sử
app.get("/api/history", (req: Request, res: Response): void => {
  res.json({
    success: true,
    history: analysisHistory,
    count: analysisHistory.length
  });
});

// Xóa tất cả lịch sử
app.delete("/api/history", (req: Request, res: Response): void => {
  try {
    const deletedCount = analysisHistory.length;
    analysisHistory = [];
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
});

// Xóa mục lịch sử cụ thể
app.delete("/api/history/:id", (req: Request, res: Response): void => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (!itemId || isNaN(itemId)) {
      res.status(400).json({
        success: false,
        error: "ID không hợp lệ - phải là số"
      });
      return;
    }
    
    const initialLength = analysisHistory.length;
    analysisHistory = analysisHistory.filter(item => item.id !== itemId);
    
    if (analysisHistory.length === initialLength) {
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
      remainingCount: analysisHistory.length
    });
  } catch (error) {
    console.error("❌ Lỗi xóa mục lịch sử:", error);
    res.status(500).json({
      success: false,
      error: "Không thể xóa mục lịch sử"
    });
  }
});

// Lấy thống kê lịch sử
app.get("/api/history/stats", (req: Request, res: Response): void => {
  try {
    const total = analysisHistory.length;
    
    if (total === 0) {
      res.json({
        success: true,
        stats: {
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
        }
      });
      return;
    }
    
    // Tính toán thống kê
    const fakeCount = analysisHistory.filter(item => item.result.isFakeNews).length;
    const realCount = total - fakeCount;
    const urlAnalyses = analysisHistory.filter(item => item.analysisType.includes('URL')).length;
    const textAnalyses = total - urlAnalyses;
    const twoStepAnalyses = analysisHistory.filter(item => item.twoStepProcess).length;
    
    const avgConfidence = Math.round(
      analysisHistory.reduce((sum, item) => sum + item.result.confidence, 0) / total
    );
    
    // Thống kê theo thời gian
    const now = new Date();
    const today = now.toDateString();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayCount = analysisHistory.filter(item => 
      new Date(item.timestamp).toDateString() === today
    ).length;
    
    const weekCount = analysisHistory.filter(item => 
      new Date(item.timestamp) >= oneWeekAgo
    ).length;
    
    const monthCount = analysisHistory.filter(item => 
      new Date(item.timestamp) >= oneMonthAgo
    ).length;
    
    res.json({
      success: true,
      stats: {
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
      }
    });
  } catch (error) {
    console.error("❌ Lỗi tính toán thống kê:", error);
    res.status(500).json({
      success: false,
      error: "Không thể tính toán thống kê"
    });
  }
});

// 📝 MIDDLEWARE LỊCH SỬ
// Tự động lưu các phân tích thành công vào lịch sử
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/api/analyze') {
    const originalJson = res.json;
    res.json = function (data: any) {
      // Lưu vào lịch sử nếu phân tích thành công
      if (data.success && data.analysis) {
        try {
          const historyEntry: HistoryEntry = {
            id: Date.now(), // ID đơn giản dựa trên timestamp
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

          // Thêm vào đầu mảng lịch sử
          analysisHistory.unshift(historyEntry);

          // Chỉ giữ 100 mục cuối để tránh vấn đề bộ nhớ
          if (analysisHistory.length > 100) {
            analysisHistory = analysisHistory.slice(0, 100);
          }

          console.log(`📊 Đã lưu vào lịch sử: ${historyEntry.analysisType} - Tổng mục: ${analysisHistory.length}`);
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
});

// 🚨 MIDDLEWARE XỬ LÝ LỖI
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Lỗi server:', err);
  res.status(500).json({ 
    success: false,
    error: 'Lỗi server nội bộ',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Có gì đó không ổn'
  });
});

// 🔍 XỬ LÝ 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Không tìm thấy endpoint API',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'POST /api/analyze - Endpoint phân tích chính',
      'GET /api/test - Kiểm tra sức khỏe',
      'GET /api/history - Lấy lịch sử phân tích',
      'DELETE /api/history - Xóa tất cả lịch sử',
      'DELETE /api/history/:id - Xóa mục lịch sử cụ thể',
      'GET /api/history/stats - Lấy thống kê lịch sử'
    ]
  });
});

// 🚀 KHỞI ĐỘNG SERVER
app.listen(port, () => {
  console.log('\n🚀 ================================');
  console.log('   API PHÁT HIỆN TIN GIẢ');
  console.log('🚀 ================================');
  console.log(`✅ Server đang chạy tại: http://localhost:${port}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}`);
  console.log(`🔍 Google Search: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}`);
  console.log(`🌐 Phân Tích Web: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Đầy đủ tính năng' : '⚠️ Hạn chế (chỉ AI)'}`);
  console.log(`📊 Tính năng: ${process.env.GOOGLE_SEARCH_API_KEY ? 'URL 2 Bước + Phân Tích Văn Bản Nâng Cao' : 'Chỉ Phân Tích AI Cơ Bản'}`);
  console.log('🚀 ================================\n');
  
  // Log các endpoint có sẵn
  console.log('📋 Các endpoint có sẵn:');
  console.log('   POST /api/analyze - Phân tích chính');
  console.log('   GET  /api/test - Kiểm tra sức khỏe');
  console.log('   GET  /api/history - Xem lịch sử');
  console.log('   DELETE /api/history - Xóa lịch sử');
  console.log('   GET  /api/history/stats - Thống kê');
  console.log('');
});
// backend/src/services/gemini.service.ts
// 🤖 Service chính cho Gemini AI - đã tách history ra

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import các service modular
import { analyzeURL } from './urlAnalyzer';
import { analyzeTextWithWebSearch } from './textAnalyzer';
import { isValidURL } from './googleSearch';
import { ApiResponse } from '../types/interfaces';

// Import history routes và middleware
import historyRoutes from '../routes/history.routes';
import { autoSaveHistoryMiddleware, historyLoggerMiddleware } from '../middlewares/history.middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Apply history middleware cho tự động lưu lịch sử
app.use(autoSaveHistoryMiddleware);
app.use(historyLoggerMiddleware);

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
        analysisMode: urlAnalysis.limitedAnalysis ? 
          "Phân Tích URL Hạn Chế" : "Phân Tích URL Cơ Bản",
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

// 📊 SỬ DỤNG HISTORY ROUTES
// Tất cả các endpoint lịch sử đã được tách ra routes riêng
app.use("/api/history", historyRoutes);

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
      'GET /api/history/stats - Lấy thống kê lịch sử',
      'GET /api/history/search - Tìm kiếm lịch sử',
      'GET /api/history/export - Export lịch sử',
      'POST /api/history/import - Import lịch sử',
      'DELETE /api/history - Xóa tất cả lịch sử',
      'DELETE /api/history/:id - Xóa mục lịch sử cụ thể',
      'GET /api/history/:id - Lấy mục lịch sử cụ thể'
    ]
  });
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
  console.log(`📊 Quản lý lịch sử: ✅ Đã tách module riêng`);
  console.log('🚀 ================================\n');
  
  // Log các endpoint có sẵn
  console.log('📋 Các endpoint có sẵn:');
  console.log('   POST /api/analyze - Phân tích chính');
  console.log('   GET  /api/test - Kiểm tra sức khỏe');
  console.log('   📊 History Endpoints:');
  console.log('   GET  /api/history - Xem lịch sử');
  console.log('   GET  /api/history/stats - Thống kê');
  console.log('   GET  /api/history/search - Tìm kiếm');
  console.log('   GET  /api/history/export - Export');
  console.log('   POST /api/history/import - Import');
  console.log('   DELETE /api/history - Xóa lịch sử');
  console.log('   DELETE /api/history/:id - Xóa mục cụ thể');
  console.log('');
});

// Export để có thể sử dụng trong các file khác nếu cần
export { app };


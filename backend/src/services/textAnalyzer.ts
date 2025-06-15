// backend/src/services/textAnalyzer.ts
// 📝 Công cụ phân tích văn bản với tích hợp tìm kiếm web

import { ApiResponse, WebContent, SearchResult, WebAnalysisResult } from '../types/interfaces';
import { searchGoogleAPI, filterTrustedUrls } from './googleSearch';
import { fetchWebContent } from './webScraper';
import { analyzeTextWithAI, analyzeTextWithWebEvidence, analyzeWebContent } from './geminiAI';

/**
 * Hàm phân tích văn bản chính với tìm kiếm web tùy chọn
 * Kết hợp phân tích AI với bằng chứng web khi có sẵn
 */
export async function analyzeTextWithWebSearch(message: string): Promise<ApiResponse> {
  console.log("📝 Bắt đầu phân tích văn bản:", message.substring(0, 100) + "...");

  // Kiểm tra Google Search API có khả dụng không
  const hasGoogleAPI = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
  
  let allSearchResults: SearchResult[] = [];
  let webContents: WebContent[] = [];
  let webAnalysis: WebAnalysisResult | null = null;
  
  if (hasGoogleAPI) {
    console.log("🔍 Bước 1: Đang tìm kiếm thông tin...");
    
    // Tạo các truy vấn tìm kiếm dựa trên văn bản đầu vào
    const searchQueries = [
      message.substring(0, 200),                    // 200 ký tự đầu
      `"${message.substring(0, 100)}"`,            // Tìm kiếm cụm từ chính xác
      `${message.substring(0, 100)} fact check`,   // Tìm kiếm fact-check
      `${message.substring(0, 100)} tin tức`,      // Tìm kiếm tin tức tiếng Việt
      `${message.substring(0, 100)} sự thật`       // Tìm kiếm sự thật tiếng Việt
    ];

    // Thực hiện tìm kiếm với nhiều truy vấn
    for (const query of searchQueries.slice(0, 4)) {
      try {
        const searchResults = await searchGoogleAPI(query, 8);
        allSearchResults = allSearchResults.concat(searchResults);
        await new Promise(resolve => setTimeout(resolve, 500)); // Giới hạn tốc độ
      } catch (error) {
        console.log("❌ Lỗi tìm kiếm:", (error as Error).message);
        // Tiếp tục với các truy vấn khác ngay cả khi một truy vấn thất bại
      }
    }

    // Loại bỏ trùng lặp và lọc URL đáng tin cậy
    const uniqueResults = allSearchResults.filter((result, index, self) => 
      index === self.findIndex(r => r.link === result.link)
    );
    
    const trustedResults = filterTrustedUrls(uniqueResults);
    console.log(`✅ Tìm thấy ${trustedResults.length} kết quả đáng tin cậy`);

    // BƯỚC 2: Tải nội dung từ các trang web
    if (trustedResults.length > 0) {
      console.log("🌐 Bước 2: Đang tải nội dung từ các trang web...");
      const maxSitesToFetch = 8;
      const fetchPromises = trustedResults.slice(0, maxSitesToFetch).map(result => 
        fetchWebContent(result.link)
      );

      webContents = await Promise.all(fetchPromises);
      const successfulFetches = webContents.filter(content => content.success);
      
      console.log(`✅ Đã tải thành công ${successfulFetches.length}/${maxSitesToFetch} trang web`);

      // BƯỚC 3: Phân tích nội dung web nếu có
      if (successfulFetches.length > 0) {
        console.log("🔍 Bước 3: Phân tích chi tiết nội dung web...");
        webAnalysis = await analyzeWebContent(message, webContents);
      }
    }
  } else {
    console.log("⚠️ Google Search API không khả dụng - chỉ sử dụng phân tích AI");
  }

  // BƯỚC 4: Phân tích chính với Gemini AI
  console.log("🤖 Bước 4: Phân tích chính với Gemini AI...");
  
  let analysisResult;
  
  if (webAnalysis && webContents.filter(c => c.success).length > 0) {
    // Phân tích nâng cao với bằng chứng web
    analysisResult = await analyzeTextWithWebEvidence(message, webContents, webAnalysis);
  } else {
    // Phân tích AI cơ bản không có bằng chứng web
    analysisResult = await analyzeTextWithAI(message);
  }

  console.log("✅ Hoàn thành phân tích");

  // Chuẩn bị phản hồi với dữ liệu đầy đủ
  const responseData: ApiResponse = {
    success: true,
    analysis: analysisResult,
    originalText: message
  };

  // Thêm thông tin web nếu có
  if (webContents.length > 0) {
    responseData.webContents = webContents
      .filter(content => content.success)
      .map(content => ({
        url: content.url,
        title: content.title,
        length: content.length,
        preview: content.content.substring(0, 300) + "..."
      }));
    
    responseData.statistics = {
      analysisMode: hasGoogleAPI ? "Phân Tích Văn Bản" : "Phân Tích AI Cơ Bản",
      totalSitesFound: allSearchResults.length,
      sitesAnalyzed: webContents.filter(c => c.success).length,
      totalContentLength: webContents.filter(c => c.success).reduce((sum, content) => sum + content.length, 0),
      sourceDomains: [...new Set(webContents.filter(c => c.success).map(content => content.url.split('/')[2]))]
    };
  } else {
    responseData.statistics = {
      analysisMode: hasGoogleAPI ? "Phân Tích AI (Không Có Kết Quả Web)" : "Phân Tích AI Cơ Bản",
      note: hasGoogleAPI ? "Không tìm thấy nguồn web liên quan" : "Google Search API chưa được cấu hình"
    };
  }

  return responseData;
}

/**
 * Phân tích văn bản đơn giản không có tìm kiếm web
 * Sử dụng làm phương án dự phòng khi tìm kiếm web không khả dụng
 */
export async function analyzeTextOnly(message: string): Promise<ApiResponse> {
  console.log("📝 Phân tích văn bản đơn giản không có tìm kiếm web");
  
  const analysisResult = await analyzeTextWithAI(message);
  
  return {
    success: true,
    analysis: analysisResult,
    originalText: message,
    statistics: {
      analysisMode: "Chỉ Phân Tích AI Cơ Bản",
      note: "Không thực hiện tìm kiếm web"
    }
  };
}
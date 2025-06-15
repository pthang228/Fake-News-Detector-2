// backend/src/services/urlAnalyzer.ts
// 🔗 Công cụ phân tích URL với quy trình xác minh 2 bước

import { AnalysisResult, WebContent, SearchResult } from '../types/interfaces';
import { searchGoogleAPI, filterTrustedUrls, extractKeywordsFromURL } from './googleSearch';
import { fetchWebContent } from './webScraper';
import { 
  analyzeFirstStepContent, 
  finalTwoStepAnalysis, 
  analyzeURLWithoutSearch 
} from './geminiAI';

/**
 * Hàm phân tích URL chính sử dụng quy trình 2 bước
 * Bước 1: Tìm kiếm dựa trên từ khóa URL
 * Bước 2: Tìm kiếm dựa trên chủ đề nội dung đã trích xuất
 */
export async function analyzeURL(url: string, originalMessage: string): Promise<AnalysisResult> {
  console.log("🔗 Bắt đầu quy trình 2 bước cho URL:", url);
  
  // BƯỚC 1: Trích xuất từ khóa từ URL để tìm kiếm ban đầu
  const urlPath = decodeURIComponent(url);
  const urlKeywords = extractKeywordsFromURL(urlPath);
  console.log("🔍 Từ khóa từ URL:", urlKeywords);
  
  // Kiểm tra Google Search API có khả dụng không
  if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
    console.log("⚠️ Không có Google API - không thể thực hiện quy trình 2 bước");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
  
  // BƯỚC 2: Tìm kiếm đầu tiên dựa trên từ khóa URL
  console.log("🔍 BƯỚC 1: Tìm kiếm dựa trên từ khóa URL");
  
  const firstQueries = [
    urlKeywords,
    `"${urlKeywords}"`,
    `${urlKeywords} tin tức`,
    `${urlKeywords} news`
  ].filter(query => query && query.trim().length > 3);
  
  let firstSearchResults: SearchResult[] = [];
  let hasQuotaError = false;
  
  // Thực hiện tìm kiếm đầu tiên với nhiều truy vấn
  for (const query of firstQueries.slice(0, 3)) {
    try {
      const searchResults = await searchGoogleAPI(query, 6);
      firstSearchResults = firstSearchResults.concat(searchResults);
      await new Promise(resolve => setTimeout(resolve, 500)); // Giới hạn tốc độ
    } catch (error) {
      console.log("❌ Lỗi tìm kiếm bước 1:", (error as Error).message);
      
      if ((error as Error).message && (error as Error).message.includes('Quota exceeded')) {
        hasQuotaError = true;
        break;
      }
    }
  }
  
  // Nếu hết quota, chuyển sang phân tích chỉ bằng AI
  if (hasQuotaError) {
    console.log("⚠️ Google Search API hết quota - chuyển sang phân tích AI");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
  
  // Xử lý kết quả tìm kiếm đầu tiên
  const uniqueFirstResults = firstSearchResults.filter((result, index, self) => 
    index === self.findIndex(r => r.link === result.link)
  );
  const trustedFirstResults = filterTrustedUrls(uniqueFirstResults);
  console.log(`✅ Tìm kiếm bước 1: tìm thấy ${trustedFirstResults.length} nguồn`);
  
  // BƯỚC 3: Tải nội dung từ kết quả tìm kiếm đầu tiên
  console.log("🌐 BƯỚC 2: Tải nội dung từ tìm kiếm bước 1");
  const firstFetchPromises = trustedFirstResults.slice(0, 5).map(result => 
    fetchWebContent(result.link)
  );
  
  const firstContents = await Promise.all(firstFetchPromises);
  const successfulFirstContents = firstContents.filter(content => content.success);
  console.log(`✅ Tải bước 1: thành công ${successfulFirstContents.length} nguồn`);
  
  // Nếu không tải được nội dung nào, chuyển sang phân tích AI
  if (successfulFirstContents.length === 0) {
    console.log("⚠️ Không tải được nội dung - chuyển sang phân tích AI");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
  
  // BƯỚC 4: Phân tích nội dung bước đầu để lấy tiêu đề chính và từ khóa
  console.log("🤖 BƯỚC 3: Phân tích nội dung để lấy tiêu đề chính và từ khóa");
  const analysisResult = await analyzeFirstStepContent(url, urlKeywords, successfulFirstContents);
  
  if (!analysisResult || !analysisResult.mainTitle || !analysisResult.keyTopics) {
    // Nếu phân tích nội dung thất bại, trả về phân tích đơn giản
    return await createSimplifiedAnalysis(url, urlKeywords, successfulFirstContents);
  }
  
  console.log("📰 Tiêu đề chính:", analysisResult.mainTitle);
  console.log("🎯 Chủ đề chính:", analysisResult.keyTopics);
  
  // BƯỚC 5: Tìm kiếm thứ hai dựa trên tiêu đề và từ khóa đã phân tích
  console.log("🔍 BƯỚC 4: Tìm kiếm thứ hai dựa trên tiêu đề chính và từ khóa");
  
  const secondQueries = [
    analysisResult.mainTitle,
    `"${analysisResult.mainTitle}"`,
    analysisResult.keyTopics.join(' '),
    `${analysisResult.mainTitle} fact check`,
    `${analysisResult.keyTopics.join(' ')} xác minh`,
    `${analysisResult.mainTitle} tin tức`
  ].filter(query => query && query.trim().length > 3);
  
  let secondSearchResults: SearchResult[] = [];
  
  // Thực hiện tìm kiếm thứ hai
  for (const query of secondQueries.slice(0, 5)) {
    try {
      const searchResults = await searchGoogleAPI(query, 6);
      // Lọc bỏ các URL đã tìm thấy trong lần tìm kiếm đầu tiên
      const newResults = searchResults.filter(result => 
        !firstSearchResults.some(first => first.link === result.link)
      );
      secondSearchResults = secondSearchResults.concat(newResults);
      await new Promise(resolve => setTimeout(resolve, 500)); // Giới hạn tốc độ
    } catch (error) {
      console.log("❌ Lỗi tìm kiếm bước 2:", (error as Error).message);
      if ((error as Error).message && (error as Error).message.includes('Quota exceeded')) {
        console.log("⚠️ Hết quota ở bước 2 - sử dụng dữ liệu từ bước 1");
        break;
      }
    }
  }
  
  // Xử lý kết quả tìm kiếm thứ hai
  const uniqueSecondResults = secondSearchResults.filter((result, index, self) => 
    index === self.findIndex(r => r.link === result.link)
  );
  const trustedSecondResults = filterTrustedUrls(uniqueSecondResults);
  console.log(`✅ Tìm kiếm bước 2: tìm thêm ${trustedSecondResults.length} nguồn mới`);
  
  // BƯỚC 6: Tải nội dung từ kết quả tìm kiếm thứ hai (nếu có)
  let successfulSecondContents: WebContent[] = [];
  
  if (trustedSecondResults.length > 0) {
    console.log("🌐 BƯỚC 5: Tải nội dung từ tìm kiếm bước 2");
    const secondFetchPromises = trustedSecondResults.slice(0, 5).map(result => 
      fetchWebContent(result.link)
    );
    
    const secondContents = await Promise.all(secondFetchPromises);
    successfulSecondContents = secondContents.filter(content => content.success);
    console.log(`✅ Tải bước 2: thành công ${successfulSecondContents.length} nguồn`);
  }
  
  // BƯỚC 7: Phân tích toàn diện cuối cùng
  console.log("🎯 BƯỚC 6: Phân tích cuối cùng với thông tin đầy đủ");
  const finalResult = await finalTwoStepAnalysis(
    url, 
    urlKeywords, 
    analysisResult, 
    successfulFirstContents, 
    successfulSecondContents,
    [...firstQueries, ...secondQueries]
  );
  
  return finalResult || await createSimplifiedAnalysis(
    url, 
    urlKeywords, 
    [...successfulFirstContents, ...successfulSecondContents]
  );
}

/**
 * Tạo phân tích đơn giản khi quy trình 2 bước đầy đủ thất bại
 */
async function createSimplifiedAnalysis(url: string, urlKeywords: string, contents: WebContent[]): Promise<AnalysisResult> {
  return {
    isFakeNews: false,
    confidence: 50,
    reason: `Phân tích đơn giản cho ${url} với ${contents.length} nguồn`,
    indicators: ["Phân tích cơ bản - cần xác minh toàn diện hơn"],
    recommendation: "Cần xác minh bổ sung từ nhiều nguồn tin đáng tin cậy",
    twoStepProcess: false,
    sourcesAnalyzed: contents.length,
    originalUrl: url,
    webEvidenceUsed: contents.length > 0,
    limitedAnalysis: true,
    reason_limited: "Quy trình 2 bước không thể hoàn thành đầy đủ"
  };
}
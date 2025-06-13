// backend/src/services/geminiAI.ts
// 🤖 Tích hợp Gemini AI để phân tích tin giả

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisResult, WebContent, FirstStepAnalysisResult, WebAnalysisResult } from '../types/interfaces';
import dotenv from 'dotenv';

dotenv.config();

// Thời gian hiện tại để có context
const ngayHienTai = new Date();
const thang = ngayHienTai.getMonth() + 1;
const nam = ngayHienTai.getFullYear();

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Phân tích văn bản cơ bản bằng Gemini AI
 * Dùng để phát hiện tin giả đơn giản không cần tìm kiếm web
 */
export async function analyzeTextWithAI(message: string): Promise<AnalysisResult> {
  const prompt = `Bạn là một chuyên gia phân tích tin tức, hiện tại là tháng ${thang} năm ${nam}. Hãy phân tích đoạn văn bản sau và xác định:

1. Đây có phải là tin giả (fake news) không?
2. Mức độ tin cậy (từ 0-100%)
3. Lý do tại sao bạn đưa ra kết luận này
4. Các dấu hiệu nhận biết

Văn bản cần phân tích: "${message}"

Trả lời theo định dạng JSON:
{
  "isFakeNews": true/false,
  "confidence": số từ 0-100,
  "reason": "lý do chi tiết",
  "indicators": ["dấu hiệu 1", "dấu hiệu 2"],
  "recommendation": "khuyến nghị cho người đọc"
}`;

  try {
    console.log("🤖 Đang gọi Gemini AI để phân tích văn bản...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Thử parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedResult = JSON.parse(jsonMatch[0]);
      return {
        ...parsedResult,
        webEvidenceUsed: false,
        sourcesAnalyzed: 0
      };
    } else {
      throw new Error("Không thể parse JSON từ Gemini");
    }
  } catch (error) {
    console.error("❌ Lỗi trong phân tích AI:", error);
    // Trả về kết quả dự phòng
    return {
      isFakeNews: false,
      confidence: 50,
      reason: "Lỗi phân tích AI - cần xác minh thủ công",
      indicators: ["Đã xảy ra lỗi hệ thống"],
      recommendation: "Vui lòng kiểm tra từ nhiều nguồn tin đáng tin cậy",
      webEvidenceUsed: false,
      sourcesAnalyzed: 0
    };
  }
}

/**
 * Phân tích văn bản nâng cao với bằng chứng web
 * Kết hợp phân tích AI với kết quả tìm kiếm web
 */
export async function analyzeTextWithWebEvidence(
  message: string, 
  webContents: WebContent[], 
  webAnalysis: WebAnalysisResult | null
): Promise<AnalysisResult> {
  
  const webContentSummary = webContents
    .filter(c => c.success)
    .map(c => `• ${c.url}: ${c.content.substring(0, 300)}...`)
    .join('\n');
  
  const prompt = `Bạn là một chuyên gia phân tích tin tức có khả năng tích hợp thông tin từ nhiều nguồn, hiện tại là tháng ${thang} năm ${nam}.

TUYÊN BỐ CẦN PHÂN TÍCH: "${message}"

THÔNG TIN BỔ SUNG TỪ WEB (${webContents.filter(c => c.success).length} nguồn):
${webContentSummary}

KẾT QUẢ PHÂN TÍCH WEB:
${webAnalysis ? JSON.stringify(webAnalysis, null, 2) : 'Không có phân tích web chi tiết'}

Hãy phân tích tổng hợp và xác định:
1. Đây có phải là tin giả không?
2. Mức độ tin cậy (0-100%)
3. Lý do chi tiết dựa trên cả phân tích AI và bằng chứng web
4. Các dấu hiệu nhận biết
5. So sánh với thông tin tìm được từ web

Trả lời theo định dạng JSON:
{
  "isFakeNews": true/false,
  "confidence": số từ 0-100,
  "reason": "lý do chi tiết tích hợp bằng chứng web",
  "indicators": ["dấu hiệu 1", "dấu hiệu 2"],
  "recommendation": "khuyến nghị cho người đọc",
  "webEvidenceUsed": true,
  "sourcesAnalyzed": ${webContents.filter(c => c.success).length}
}`;

  try {
    console.log("🤖 Đang gọi Gemini AI để phân tích nâng cao với bằng chứng web...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Không thể parse JSON");
    }
  } catch (error) {
    console.error("❌ Lỗi trong phân tích AI nâng cao:", error);
    return {
      isFakeNews: false,
      confidence: 50,
      reason: `Lỗi phân tích nâng cao - đã tìm thấy ${webContents.filter(c => c.success).length} nguồn nhưng AI xử lý thất bại`,
      indicators: ["Lỗi xử lý phân tích"],
      recommendation: "Đã thu thập bằng chứng web nhưng cần xem xét thủ công",
      webEvidenceUsed: true,
      sourcesAnalyzed: webContents.filter(c => c.success).length
    };
  }
}

/**
 * Phân tích bước đầu cho xử lý URL  
 * Phân tích nội dung web ban đầu để trích xuất chủ đề chính và từ khóa
 */
export async function analyzeFirstStepContent(
  originalUrl: string, 
  urlKeywords: string, 
  contents: WebContent[]
): Promise<FirstStepAnalysisResult | null> {
  
  if (!contents || contents.length === 0) {
    return null;
  }
  
  const contentSummary = contents.map((content, index) => 
    `--- NGUỒN ${index + 1}: ${content.url} ---
TIÊU ĐỀ: ${content.title}
NỘI DUNG: ${content.content.substring(0, 1000)}...`
  ).join('\n\n');

  const prompt = `Bạn là chuyên gia phân tích nội dung, hiện tại là tháng ${thang} năm ${nam}. Phân tích các nguồn tin sau để xác định:

URL GỐC: ${originalUrl}
TỪ KHÓA TỪ URL: ${urlKeywords}

CÁC NGUỒN TIN ĐÃ TÌM ĐƯỢC (${contents.length} nguồn):
${contentSummary}

NHIỆM VỤ:
1. Xác định TIÊU ĐỀ CHÍNH của sự kiện/tin tức
2. Trích xuất CÁC CHỦ ĐỀ CHÍNH và từ khóa quan trọng
3. Tóm tắt nội dung cốt lõi
4. Xác định các nhân vật, địa điểm, sự kiện chính

Trả lời theo JSON:
{
  "mainTitle": "tiêu đề chính của sự kiện",
  "keyTopics": ["chủ đề 1", "chủ đề 2", "chủ đề 3"],
  "coreContent": "tóm tắt nội dung cốt lõi",
  "mainEntities": ["nhân vật/tổ chức chính"],
  "eventLocation": "địa điểm xảy ra sự kiện",
  "eventType": "loại sự kiện (chính trị/kinh tế/xã hội/etc)",
  "urgencyLevel": "mức độ khẩn cấp (high/medium/low)"
}`;

  try {
    console.log("🤖 Đang phân tích nội dung bước đầu để lấy chủ đề chính...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("❌ Lỗi trong phân tích bước đầu:", error);
    return null;
  }
}

/**
 * Phân tích cuối cùng cho quy trình 2 bước
 * Kết hợp kết quả từ cả hai bước tìm kiếm để phân tích toàn diện
 */
export async function finalTwoStepAnalysis(
  originalUrl: string, 
  urlKeywords: string, 
  analysisResult: FirstStepAnalysisResult, 
  firstContents: WebContent[], 
  secondContents: WebContent[], 
  allQueries: string[]
): Promise<AnalysisResult | null> {
  
  const totalSources = firstContents.length + secondContents.length;
  
  const firstContentSummary = firstContents.map((content, index) => 
    `--- NGUỒN BƯỚC 1.${index + 1}: ${content.url} ---
TIÊU ĐỀ: ${content.title}
NỘI DUNG: ${content.content.substring(0, 800)}...`
  ).join('\n\n');
  
  const secondContentSummary = secondContents.map((content, index) => 
    `--- NGUỒN BƯỚC 2.${index + 1}: ${content.url} ---
TIÊU ĐỀ: ${content.title}
NỘI DUNG: ${content.content.substring(0, 800)}...`
  ).join('\n\n');

  const prompt = `Bạn là chuyên gia fact-checking hàng đầu, hiện tại là tháng ${thang} năm ${nam}. Phân tích URL bằng quy trình 2 bước đã hoàn thành:

URL NGUỒN GỐC: ${originalUrl}

QUY TRÌNH ĐÃ THỰC HIỆN:
1. Search dựa trên URL keywords: "${urlKeywords}"
2. Fetch và phân tích ${firstContents.length} nguồn đầu tiên
3. Xác định tiêu đề chính: "${analysisResult.mainTitle}"
4. Search lại dựa trên tiêu đề và keywords: ${analysisResult.keyTopics.join(', ')}
5. Fetch thêm ${secondContents.length} nguồn bổ sung
6. Phân tích tổng hợp

PHÂN TÍCH BƯỚC 1:
Tiêu đề chính: ${analysisResult.mainTitle}
Chủ đề chính: ${analysisResult.keyTopics.join(', ')}
Loại sự kiện: ${analysisResult.eventType}
Nội dung cốt lõi: ${analysisResult.coreContent}

NGUỒN TIN BƯỚC 1 (${firstContents.length} nguồn):
${firstContentSummary}

NGUỒN TIN BƯỚC 2 (${secondContents.length} nguồn):
${secondContentSummary}

NHIỆM VỤ PHÂN TÍCH CUỐI CÙNG:
1. So sánh thông tin từ ${totalSources} nguồn khác nhau
2. Đánh giá độ tin cậy của thông tin liên quan đến URL gốc
3. Xác định tính nhất quán của thông tin
4. Phát hiện mâu thuẫn hoặc xác nhận
5. Đưa ra kết luận về URL gốc

Trả lời theo JSON:
{
  "isFakeNews": true/false,
  "confidence": số từ 0-100,
  "reason": "phân tích chi tiết dựa trên quy trình 2 bước với ${totalSources} nguồn",
  "indicators": ["dấu hiệu từ việc phân tích 2 bước"],
  "recommendation": "khuyến nghị dựa trên cross-reference",
  "twoStepFindings": "kết quả từ quy trình 2 bước",
  "firstStepAnalysis": "phát hiện từ bước 1 (${firstContents.length} nguồn)",
  "secondStepAnalysis": "phát hiện từ bước 2 (${secondContents.length} nguồn)",
  "consistencyCheck": "mức độ nhất quán giữa ${totalSources} nguồn",
  "mainTopicVerification": "xác minh chủ đề chính: ${analysisResult.mainTitle}",
  "sourceDistribution": "phân bố nguồn tin và độ tin cậy",
  "webEvidenceUsed": true,
  "sourcesAnalyzed": ${totalSources},
  "twoStepProcess": true,
  "originalUrl": "${originalUrl}",
  "searchQueries": ${JSON.stringify(allQueries)},
  "identifiedTitle": "${analysisResult.mainTitle}",
  "keyTopics": ${JSON.stringify(analysisResult.keyTopics)}
}`;

  try {
    console.log("🤖 Đang thực hiện phân tích cuối cùng 2 bước...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("❌ Lỗi trong phân tích cuối cùng 2 bước:", error);
    return {
      isFakeNews: false,
      confidence: 40,
      reason: `Hoàn thành quy trình 2 bước với ${totalSources} nguồn nhưng gặp lỗi phân tích cuối: ${(error as Error).message}`,
      indicators: ["Lỗi xử lý cuối cùng"],
      recommendation: "Đã thu thập đủ thông tin, cần xem xét thủ công",
      twoStepProcess: true,
      sourcesAnalyzed: totalSources,
      originalUrl: originalUrl,
      webEvidenceUsed: true
    };
  }
}

/**
 * Phân tích URL không có tìm kiếm web (phương pháp dự phòng)
 * Sử dụng khi Google Search API không khả dụng hoặc hết quota
 */
export async function analyzeURLWithoutSearch(url: string, urlKeywords: string): Promise<AnalysisResult> {
  console.log("🤖 Phân tích URL không có search - dựa trên AI và keywords");
  
  const prompt = `Bạn là chuyên gia fact-checking, hiện tại là tháng ${thang} năm ${nam}. Phân tích URL và keywords được trích xuất để đưa ra đánh giá sơ bộ.

URL GỐC: ${url}
KEYWORDS TRÍCH XUẤT: ${urlKeywords}

NHIỆM VỤ PHÂN TÍCH:
1. Đánh giá domain và độ tin cậy của nguồn
2. Phân tích keywords để hiểu chủ đề chính
3. Đưa ra nhận định về tính chất của thông tin
4. Khuyến nghị cách kiểm tra thêm

LƯU Ý:
- Đây là phân tích sơ bộ do không có thông tin từ search
- Cần kiểm tra cross-reference từ nhiều nguồn khác
- Đánh giá chủ yếu dựa trên domain và keywords

Trả lời theo JSON:
{
  "isFakeNews": true/false,
  "confidence": số từ 0-100,
  "reason": "phân tích dựa trên domain và keywords, không có cross-reference",
  "indicators": ["dấu hiệu từ URL và keywords"],
  "recommendation": "khuyến nghị kiểm tra thêm từ nhiều nguồn",
  "domainAnalysis": "đánh giá về domain ${url.split('/')[2]}",
  "topicAnalysis": "phân tích chủ đề từ keywords: ${urlKeywords}",
  "webEvidenceUsed": false,
  "sourcesAnalyzed": 0,
  "twoStepProcess": false,
  "originalUrl": "${url}",
  "limitedAnalysis": true,
  "reason_limited": "Google Search API hết quota hoặc không có"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {
      isFakeNews: false,
      confidence: 30,
      reason: "Không thể phân tích do thiếu dữ liệu search",
      indicators: ["Cần Google Search để phân tích đầy đủ"],
      recommendation: "Kiểm tra thủ công từ nhiều nguồn tin đáng tin cậy",
      limitedAnalysis: true,
      originalUrl: url,
      webEvidenceUsed: false,
      sourcesAnalyzed: 0
    };
  } catch (error) {
    console.error("❌ Lỗi phân tích không có search:", error);
    return {
      isFakeNews: false,
      confidence: 20,
      reason: `Lỗi phân tích URL ${url}: ${(error as Error).message}`,
      indicators: ["Lỗi hệ thống"],
      recommendation: "Cần kiểm tra thủ công",
      limitedAnalysis: true,
      originalUrl: url,
      error: (error as Error).message,
      webEvidenceUsed: false,
      sourcesAnalyzed: 0
    };
  }
}

/**
 * Phân tích sâu nội dung web
 * Phân tích nội dung web đã thu thập để tìm bằng chứng ủng hộ/phản bác
 */
export async function analyzeWebContent(originalText: string, webContents: WebContent[]): Promise<WebAnalysisResult | null> {
  if (!webContents || webContents.length === 0) {
    return null;
  }
  
  const validContents = webContents.filter(content => content.success && content.content.length > 200);
  
  if (validContents.length === 0) {
    return null;
  }
  
  const contentSummary = validContents.map((content, index) => 
    `--- NGUỒN ${index + 1}: ${content.url} ---
TIÊU ĐỀ: ${content.title}
NỘI DUNG: ${content.content.substring(0, 2000)}...
(Tổng cộng: ${content.length} ký tự)`
  ).join('\n\n');

  const prompt = `Bạn là chuyên gia phân tích thông tin hàng đầu, hiện tại là tháng ${thang} năm ${nam}. Phân tích TOÀN BỘ nội dung từ các trang web đã thu thập để đưa ra đánh giá chính xác nhất về tuyên bố:

TUYÊN BỐ CẦN KIỂM TRA: "${originalText}"

NỘI DUNG CHI TIẾT TỪ CÁC TRANG WEB:
${contentSummary}

NHIỆM VỤ PHÂN TÍCH SÂU:
1. ĐỌC KỸ TOÀN BỘ nội dung từ tất cả các nguồn
2. PHÂN TÍCH mối liên hệ giữa tuyên bố và thông tin thu thập được
3. XÁC ĐỊNH các bằng chứng ủng hộ và phản bác cụ thể
4. ĐÁNH GIÁ độ tin cậy của từng nguồn
5. XEM XÉT ngữ cảnh, thời gian, địa điểm của thông tin
6. PHÁT HIỆN các sắc thái, ngoại lệ, điều kiện đặc biệt
7. SO SÁNH thông tin từ nhiều nguồn khác nhau

YÊU CẦU PHÂN TÍCH:
- Phải dựa trên TOÀN BỘ nội dung đã đọc, không chỉ snippet
- Trích dẫn CỤ THỂ từ các nguồn để minh chứng
- Giải thích chi tiết lý do kết luận
- Xem xét mọi khía cạnh có thể

Trả lời theo JSON:
{
  "detailedAnalysis": "phân tích chi tiết dựa trên toàn bộ nội dung đã đọc",
  "supportingEvidence": ["bằng chứng ủng hộ CỤ THỂ với trích dẫn"],
  "contradictingEvidence": ["bằng chứng phản bác CỤ THỂ với trích dẫn"],
  "sourceAnalysis": {
    "source1": "đánh giá chi tiết nguồn 1",
    "source2": "đánh giá chi tiết nguồn 2"
  },
  "contextualFactors": ["yếu tố ngữ cảnh quan trọng"],
  "nuancesFound": ["các sắc thái, ngoại lệ phát hiện được"],
  "crossReferenceFindings": "kết quả so sánh thông tin giữa các nguồn",
  "contentBasedConclusion": "kết luận dựa trên phân tích sâu nội dung"
}`;

  try {
    console.log("🤖 Đang thực hiện phân tích sâu nội dung web...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("❌ Lỗi phân tích nội dung web:", error);
    return null;
  }
}
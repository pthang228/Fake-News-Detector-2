// backend/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Types definitions
interface WebContent {
  url: string;
  content: string;
  title: string;
  success: boolean;
  length: number;
  note?: string;
  error?: string;
}

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
  formattedUrl?: string;
}

interface AnalysisResult {
  isFakeNews: boolean;
  confidence: number;
  reason: string;
  indicators: string[];
  recommendation: string;
  webEvidenceUsed: boolean;
  sourcesAnalyzed: number;
  twoStepProcess?: boolean;
  originalUrl?: string;
  searchQueries?: string[];
  identifiedTitle?: string;
  keyTopics?: string[];
  limitedAnalysis?: boolean;
  reason_limited?: string;
  error?: string;
  twoStepFindings?: string;
  firstStepAnalysis?: string;
  secondStepAnalysis?: string;
  consistencyCheck?: string;
  mainTopicVerification?: string;
  sourceDistribution?: string;
  domainAnalysis?: string;
  topicAnalysis?: string;
}

interface FirstStepAnalysisResult {
  mainTitle: string;
  keyTopics: string[];
  coreContent: string;
  mainEntities: string[];
  eventLocation: string;
  eventType: string;
  urgencyLevel: string;
}

interface WebAnalysisResult {
  detailedAnalysis: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  sourceAnalysis: { [key: string]: string };
  contextualFactors: string[];
  nuancesFound: string[];
  crossReferenceFindings: string;
  contentBasedConclusion: string;
}

interface HistoryEntry {
  id: number;
  text: string;
  result: AnalysisResult;
  sourcesAnalyzed: number;
  analysisType: string;
  timestamp: string;
  originalUrl?: string;
  identifiedTitle?: string;
  keyTopics?: string[];
  twoStepProcess?: boolean;
}

interface Statistics {
  analysisMode?: string;
  originalUrl?: string;
  sourcesAnalyzed?: number;
  identifiedTitle?: string;
  keyTopics?: string[];
  searchQueries?: string[];
  twoStepEnabled?: boolean;
  note?: string;
  totalSitesFound?: number;
  sitesAnalyzed?: number;
  totalContentLength?: number;
  sourceDomains?: string[];
}

interface ApiResponse {
  success: boolean;
  analysis?: AnalysisResult;
  originalText?: string;
  twoStepProcess?: boolean;
  originalUrl?: string;
  statistics?: Statistics;
  webContents?: Array<{
    url: string;
    title: string;
    length: number;
    preview: string;
  }>;
  error?: string;
  details?: string;
  url?: string;
  isUrl?: boolean;
}


const ngayHienTai = new Date();
const thang = ngayHienTai.getMonth() + 1;
const nam = ngayHienTai.getFullYear();

const app = express();
const port = process.env.PORT || 5000;

// Khởi tạo Gemini AI - sử dụng gemini-2.0-flash thay vì gemini-1.5-flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.use(cors());
app.use(express.json());

// Lịch sử phân tích (lưu trong memory)
let analysisHistory: HistoryEntry[] = [];

// Cấu hình User-Agent để tránh bị block
const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

// Hàm lấy User-Agent ngẫu nhiên
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Hàm trích xuất nội dung text từ HTML
function extractTextFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Loại bỏ các thẻ không cần thiết
    $('script, style, nav, footer, header, aside, .advertisement, .ads, .social-share, .comments, .sidebar').remove();
    
    // Lấy nội dung chính
    let mainContent = '';
    
    // Ưu tiên các selector phổ biến cho nội dung chính
    const contentSelectors: string[] = [
      'article',
      '[role="main"]', 
      '.content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.article-body',
      '.story-body',
      '.content-body',
      'main',
      '.main-content',
      '.post-body',
      '.article-text',
      '.story-content',
      '#content',
      '.news-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const elementText = element.text().trim();
        if (elementText.length > 100) {
          mainContent = elementText;
          break;
        }
      }
    }
    
    // Nếu không tìm thấy nội dung chính, lấy toàn bộ body
    if (!mainContent || mainContent.length < 100) {
      const bodyText = $('body').text().trim();
      if (bodyText.length > 0) {
        mainContent = bodyText;
      }
    }
    
    // Nếu vẫn không có, lấy toàn bộ text
    if (!mainContent || mainContent.length < 50) {
      mainContent = $.text().trim();
    }
    
    // Làm sạch text
    if (mainContent) {
      mainContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .replace(/\t+/g, ' ')
        .trim();
    }
    
    return mainContent || '';
    
  } catch (error) {
    console.error("Lỗi khi trích xuất text từ HTML:", (error as Error).message);
    return '';
  }
}

// Hàm trích xuất title từ HTML
function extractTitleFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    return $('title').text().trim() || $('h1').first().text().trim() || '';
  } catch (error) {
    return '';
  }
}


// Hàm fetch nội dung từ URL với retry logic và error handling cải tiến
async function fetchWebContent(url: string, maxRetries: number = 1): Promise<WebContent> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 Đang fetch nội dung từ: ${url} (lần thử ${attempt})`);
      
      const response: AxiosResponse<string> = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      
      if (response.data && typeof response.data === 'string' && response.data.length > 0) {
        const textContent = extractTextFromHTML(response.data);
        const title = extractTitleFromHTML(response.data);
        
        if (textContent && textContent.length > 50) {
          console.log(`✅ Fetch thành công: ${textContent.length} ký tự từ ${url}`);
          return {
            url: url,
            content: textContent,
            title: title || 'Không có tiêu đề',
            success: true,
            length: textContent.length
          };
        } else {
          console.log(`⚠️ Nội dung quá ngắn: ${textContent?.length || 0} ký tự từ ${url}`);
          
          // Fallback: thử lấy meta description và các thông tin khác
          const $ = cheerio.load(response.data);
          const metaDescription = $('meta[name="description"]').attr('content') || '';
          const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
          const ogDescription = $('meta[property="og:description"]').attr('content') || '';
          const h1Text = $('h1').text().trim();
          const h2Text = $('h2').first().text().trim();
          
          const fallbackContent = [title, h1Text, h2Text, metaDescription, ogDescription, metaKeywords]
            .filter((text): text is string => text !== null && text !== undefined && text.length > 0)
            .join('\n\n');
          
          if (fallbackContent.length > 30) {
            console.log(`✅ Sử dụng fallback content: ${fallbackContent.length} ký tự từ ${url}`);
            return {
              url: url,
              content: fallbackContent,
              title: title || h1Text || 'Không có tiêu đề',
              success: true,
              length: fallbackContent.length,
              note: 'Sử dụng meta data do không trích xuất được nội dung chính'
            };
          }
        }
      }
      
      throw new Error(`Không thể trích xuất nội dung hữu ích từ ${url}`);
      
    } catch (error) {
      console.log(`❌ Lần thử ${attempt} thất bại cho ${url}: ${(error as Error).message}`);
      
      if (attempt === maxRetries) {
        return {
          url: url,
          content: '',
          title: '',
          success: false,
          length: 0,
          error: (error as Error).message
        };
      }
      
      // Đợi trước khi thử lại
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  // TypeScript requires a return statement here
  return {
    url: url,
    content: '',
    title: '',
    success: false,
    length: 0,
    error: 'Max retries exceeded'
  };
}


// Hàm search Google Custom Search API
async function searchGoogleAPI(query: string, maxResults: number = 10): Promise<SearchResult[]> {
  try {
    const searchUrl = 'https://www.googleapis.com/customsearch/v1';
    
    const params = {
      key: process.env.GOOGLE_SEARCH_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: query,
      num: Math.min(maxResults, 10),
      safe: 'medium',
      lr: 'lang_vi|lang_en'
    };

    const response = await axios.get(searchUrl, { params });
    
    if (response.data.items) {
      return response.data.items.map((item: any) => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link,
        displayLink: item.displayLink,
        formattedUrl: item.formattedUrl
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Lỗi khi gọi Google Search API:', (error as any).response?.data || (error as Error).message);
    return [];
  }
}

// Hàm lọc các URL đáng tin cậy
function filterTrustedUrls(searchResults: SearchResult[]): SearchResult[] {
  const trustedDomains: string[] = [
    'wikipedia.org',
    'gov.vn',
    'edu.vn',
    'bbc.com',
    'cnn.com',
    'reuters.com',
    'ap.org',
    'vnexpress.net',
    'tuoitre.vn',
    'thanhnien.vn',
    'vietnamnet.vn',
    'dantri.com.vn',
    'vietNamNews.vn',
    'bloomberg.com',
    'wsj.com',
    'nytimes.com',
    'theguardian.com',
    'factcheck.org',
    'snopes.com',
    'politifact.com'
  ];
  
  const lowQualityDomains: string[] = [
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'reddit.com'
  ];
  
  return searchResults.filter(result => {
    const domain = result.displayLink.toLowerCase();
    
    // Loại bỏ domain chất lượng thấp
    if (lowQualityDomains.some(bad => domain.includes(bad))) {
      return false;
    }
    
    // Ưu tiên domain đáng tin cậy
    return true;
  }).sort((a, b) => {
    const aTrusted = trustedDomains.some(trusted => a.displayLink.toLowerCase().includes(trusted));
    const bTrusted = trustedDomains.some(trusted => b.displayLink.toLowerCase().includes(trusted));
    
    if (aTrusted && !bTrusted) return -1;
    if (!aTrusted && bTrusted) return 1;
    return 0;
  });
}

// Hàm kiểm tra xem input có phải là URL không
function isValidURL(string: string): boolean {
  try {
    const url = new URL(string.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}


// Hàm trích xuất keywords từ URL path (cải tiến cho URL MSN và các URL tiếng Việt)
function extractKeywordsFromURL(urlPath: string): string {
  try {
    console.log("🔍 Đang phân tích URL:", urlPath);
    
    // Decode URL trước
    const decodedPath = decodeURIComponent(urlPath);
    console.log("🔍 URL đã decode:", decodedPath);
    
    // Tách thành các phần
    const pathParts = decodedPath.split('/');
    
    // Tìm phần chứa content tiếng Việt (thường có dấu hoặc ký tự đặc biệt)
    let bestKeywords = '';
    let maxScore = 0;
    
    for (const part of pathParts) {
      if (part.length < 5) continue; // Bỏ qua phần quá ngắn
      
      // Tính điểm cho mỗi phần dựa trên:
      let score = 0;
      
      // 1. Có ký tự tiếng Việt
      if (/[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(part)) {
        score += 10;
      }
      
      // 2. Có nhiều từ (dấu gạch ngang)
      const wordCount = part.split(/[-_]/).length;
      score += wordCount;
      
      // 3. Độ dài hợp lý
      if (part.length > 20 && part.length < 200) {
        score += 5;
      }
      
      // 4. Không phải tham số query
      if (!part.includes('=') && !part.includes('?') && !part.includes('&')) {
        score += 3;
      }
      
      // 5. Không phải ID ngẫu nhiên
      if (!/^[a-zA-Z0-9]{10,}$/.test(part)) {
        score += 2;
      }
      
      console.log(`🔍 Phần "${part.substring(0, 50)}..." có điểm: ${score}`);
      
      if (score > maxScore) {
        maxScore = score;
        bestKeywords = part;
      }
    }
    
    if (bestKeywords) {
      // Làm sạch keywords tốt nhất
      let cleanKeywords = bestKeywords
        .replace(/[-_]/g, ' ') // Thay gạch ngang bằng khoảng trắng
        .replace(/%[0-9A-F]{2}/gi, ' ') // Loại bỏ URL encoding còn sót
        .replace(/[^a-zA-Z0-9\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`✅ Keywords tốt nhất: "${cleanKeywords}"`);
      return cleanKeywords;
    }
    
    // Fallback: nếu không tìm được, thử lấy từ domain và path
    const domain = urlPath.split('/')[2] || '';
    const lastPath = pathParts[pathParts.length - 1] || '';
    
    let fallbackKeywords = '';
    
    // Nếu là MSN, thử extract từ category
    if (domain.includes('msn.com')) {
      // Tìm category như "lifestyle/living" hoặc "sports/other"
      const categoryIndex = pathParts.findIndex(part => 
        ['lifestyle', 'sports', 'news', 'entertainment', 'health', 'technology'].includes(part)
      );
      
      if (categoryIndex >= 0 && pathParts[categoryIndex + 1]) {
        fallbackKeywords = `${pathParts[categoryIndex]} ${pathParts[categoryIndex + 1]}`;
      }
    }
    
    if (!fallbackKeywords) {
      // Thử lấy từ path cuối và làm sạch
      fallbackKeywords = lastPath
        .replace(/[^a-zA-Z0-9\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    console.log(`🔄 Fallback keywords: "${fallbackKeywords}"`);
    return fallbackKeywords || 'tin tức mới';
    
  } catch (error) {
    console.error("Lỗi extract keywords từ URL:", error);
    return 'tin tức';
  }
}


// Hàm phân tích nội dung bước 1 để lấy tiêu đề và keywords chính
async function analyzeFirstStepContent(originalUrl: string, urlKeywords: string, contents: WebContent[]): Promise<FirstStepAnalysisResult | null> {
  if (!contents || contents.length === 0) {
    return null;
  }
  
  const contentSummary = contents.map((content, index) => 
    `--- NGUỒN ${index + 1}: ${content.url} ---
TIÊU ĐỀ: ${content.title}
NỘI DUNG: ${content.content.substring(0, 1000)}...`
  ).join('\n\n');

  const prompt = `
Bạn là chuyên gia phân tích nội dung, hiện tại là tháng ${thang} năm ${nam}. Phân tích các nguồn tin sau để xác định:

URL GỐC: ${originalUrl}
KEYWORDS TỪ URL: ${urlKeywords}

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
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("Lỗi phân tích bước 1:", error);
    return null;
  }
}

// Hàm phân tích cuối cùng với quy trình 2 bước
async function finalTwoStepAnalysis(
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

  const prompt = `
Bạn là chuyên gia fact-checking hàng đầu, hiện tại là tháng ${thang} năm ${nam}. Phân tích URL bằng quy trình 2 bước đã hoàn thành:

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
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("Lỗi phân tích cuối cùng 2 bước:", error);
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

// Hàm phân tích đơn giản khi không có đủ dữ liệu
async function simplifiedAnalysis(url: string, urlKeywords: string, contents: WebContent[]): Promise<AnalysisResult> {
  return {
    isFakeNews: false,
    confidence: 50,
    reason: `Phân tích đơn giản cho ${url} với ${contents.length} nguồn`,
    indicators: ["Phân tích cơ bản"],
    recommendation: "Cần thêm thông tin để đánh giá chính xác",
    twoStepProcess: false,
    sourcesAnalyzed: contents.length,
    originalUrl: url,
    webEvidenceUsed: contents.length > 0
  };
}

// Hàm phân tích URL theo quy trình 2 bước với fallback khi hết quota
async function analyzeURL(url: string, originalMessage: string): Promise<AnalysisResult> {
  console.log("🔗 Bắt đầu quy trình 2 bước cho URL:", url);
  
  // BƯỚC 1: Tạo keywords từ URL để search trước
  const urlPath = decodeURIComponent(url);
  const urlKeywords = extractKeywordsFromURL(urlPath);
  console.log("🔍 Keywords từ URL:", urlKeywords);
  
  // BƯỚC 2: Search lần 1 dựa trên URL keywords
  let firstSearchResults: SearchResult[] = [];
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    console.log("🔍 BƯỚC 1: Search dựa trên URL keywords");
    
    const firstQueries = [
      urlKeywords,
      `"${urlKeywords}"`,
      `${urlKeywords} tin tức`,
      `${urlKeywords} news`
    ].filter(query => query && query.trim().length > 3);
    
    let hasQuotaError = false;
    
    for (const query of firstQueries.slice(0, 3)) {
      try {
        const searchResults = await searchGoogleAPI(query, 6);
        firstSearchResults = firstSearchResults.concat(searchResults);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log("Lỗi search lần 1:", (error as Error).message);
        
        // Kiểm tra nếu là lỗi quota
        if ((error as Error).message && (error as Error).message.includes('Quota exceeded')) {
          hasQuotaError = true;
          break;
        }
      }
    }
    
    // Nếu hết quota, chuyển sang phân tích không có search
    if (hasQuotaError) {
      console.log("⚠️ Google Search API hết quota - chuyển sang phân tích dựa trên AI");
      return await analyzeURLWithoutSearch(url, urlKeywords);
    }
    
    const uniqueFirstResults = firstSearchResults.filter((result, index, self) => 
      index === self.findIndex(r => r.link === result.link)
    );
    const trustedFirstResults = filterTrustedUrls(uniqueFirstResults);
    console.log(`✅ Search lần 1: tìm thấy ${trustedFirstResults.length} nguồn`);
    
    // BƯỚC 3: Fetch nội dung từ search results lần 1 (PHẦN BỊ THIẾU TRONG CODE CŨ)
    console.log("🌐 BƯỚC 2: Fetch nội dung từ search lần 1");
    const firstFetchPromises = trustedFirstResults.slice(0, 5).map(result => 
      fetchWebContent(result.link)
    );
    
    const firstContents = await Promise.all(firstFetchPromises);
    const successfulFirstContents = firstContents.filter(content => content.success);
    console.log(`✅ Fetch lần 1: thành công ${successfulFirstContents.length} nguồn`);
    
    // Nếu không có nội dung nào được fetch thành công
    if (successfulFirstContents.length === 0) {
      console.log("⚠️ Không fetch được nội dung - chuyển sang phân tích AI");
      return await analyzeURLWithoutSearch(url, urlKeywords);
    }
    
    // BƯỚC 4: Phân tích nội dung lần 1 để lấy tiêu đề và keywords chính
    console.log("🤖 BƯỚC 3: Phân tích nội dung để lấy tiêu đề và keywords chính");
    const analysisResult = await analyzeFirstStepContent(url, urlKeywords, successfulFirstContents);
    
    if (analysisResult && analysisResult.mainTitle && analysisResult.keyTopics) {
      console.log("📰 Tiêu đề chính:", analysisResult.mainTitle);
      console.log("🎯 Keywords chính:", analysisResult.keyTopics);
      
      // BƯỚC 5: Search lần 2 dựa trên tiêu đề và keywords đã phân tích
      console.log("🔍 BƯỚC 4: Search lần 2 dựa trên tiêu đề và keywords chính");
      
      const secondQueries = [
        analysisResult.mainTitle,
        `"${analysisResult.mainTitle}"`,
        analysisResult.keyTopics.join(' '),
        `${analysisResult.mainTitle} fact check`,
        `${analysisResult.keyTopics.join(' ')} xác minh`,
        `${analysisResult.mainTitle} tin tức`
      ].filter(query => query && query.trim().length > 3);
      
      let secondSearchResults: SearchResult[] = [];
      for (const query of secondQueries.slice(0, 5)) {
        try {
          const searchResults = await searchGoogleAPI(query, 6);
          // Loại bỏ những URL đã có từ lần search trước
          const newResults = searchResults.filter(result => 
            !firstSearchResults.some(first => first.link === result.link)
          );
          secondSearchResults = secondSearchResults.concat(newResults);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log("Lỗi search lần 2:", (error as Error).message);
          // Nếu hết quota ở lần 2, dừng search nhưng vẫn tiếp tục phân tích
          if ((error as Error).message && (error as Error).message.includes('Quota exceeded')) {
            console.log("⚠️ Hết quota ở bước 2 - sử dụng dữ liệu từ bước 1");
            break;
          }
        }
      }
      
      const uniqueSecondResults = secondSearchResults.filter((result, index, self) => 
        index === self.findIndex(r => r.link === result.link)
      );
      const trustedSecondResults = filterTrustedUrls(uniqueSecondResults);
      console.log(`✅ Search lần 2: tìm thêm ${trustedSecondResults.length} nguồn mới`);
      
      // BƯỚC 6: Fetch nội dung từ search results lần 2  
      if (trustedSecondResults.length > 0) {
        console.log("🌐 BƯỚC 5: Fetch nội dung từ search lần 2");
        const secondFetchPromises = trustedSecondResults.slice(0, 5).map(result => 
          fetchWebContent(result.link)
        );
        
        const secondContents = await Promise.all(secondFetchPromises);
        const successfulSecondContents = secondContents.filter(content => content.success);
        console.log(`✅ Fetch lần 2: thành công ${successfulSecondContents.length} nguồn`);
        
        // BƯỚC 7: Phân tích cuối cùng với tất cả thông tin
        console.log("🎯 BƯỚC 6: Phân tích cuối cùng với toàn bộ thông tin");
        const finalResult = await finalTwoStepAnalysis(
          url, 
          urlKeywords, 
          analysisResult, 
          successfulFirstContents, 
          successfulSecondContents,
          [...firstQueries, ...secondQueries]
        );
        return finalResult || await simplifiedAnalysis(url, urlKeywords, [...successfulFirstContents, ...successfulSecondContents]);
      } else {
        // Chỉ có dữ liệu từ bước 1
        console.log("🎯 Phân tích với dữ liệu từ bước 1");
        const finalResult = await finalTwoStepAnalysis(
          url, 
          urlKeywords, 
          analysisResult, 
          successfulFirstContents, 
          [], // Không có second contents
          firstQueries
        );
        return finalResult || await simplifiedAnalysis(url, urlKeywords, successfulFirstContents);
      }
    } else {
      // Nếu không phân tích được nội dung, chỉ dùng kết quả lần 1
      return await simplifiedAnalysis(url, urlKeywords, successfulFirstContents);
    }
  } else {
    console.log("⚠️ Không có Google API - không thể thực hiện quy trình 2 bước");
    return await analyzeURLWithoutSearch(url, urlKeywords);
  }
}


// Hàm phân tích URL khi không có search (fallback)
async function analyzeURLWithoutSearch(url: string, urlKeywords: string): Promise<AnalysisResult> {
  console.log("🤖 Phân tích URL không có search - dựa trên AI và keywords");
  
  const prompt = `
Bạn là chuyên gia fact-checking, hiện tại là tháng ${thang} năm ${nam}. Phân tích URL và keywords được trích xuất để đưa ra đánh giá sơ bộ.

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
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
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
    console.error("Lỗi phân tích không có search:", error);
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

// Hàm phân tích nội dung web đã fetch
async function analyzeWebContent(originalText: string, webContents: WebContent[]): Promise<WebAnalysisResult | null> {
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
(Tổng cộng: ${content.length} ký tự)
`
  ).join('\n\n');

  const prompt = `
Bạn là chuyên gia phân tích thông tin hàng đầu, hiện tại là tháng ${thang} năm ${nam}. Phân tích TOÀN BỘ nội dung từ các trang web đã thu thập để đưa ra đánh giá chính xác nhất về tuyên bố:

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
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("Lỗi phân tích nội dung web:", error);
    return null;
  }
}


// Route phân tích tin tức với Gemini và Web Content Analysis
app.post("/api/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { message }: { message: string } = req.body;

    if (!message || message.trim() === "") {
      res.status(400).json({
        error: "Vui lòng nhập nội dung cần phân tích"
      });
      return;
    }

    console.log("📝 Bắt đầu phân tích:", message.substring(0, 100) + "...");

    // KIỂM TRA XEM INPUT CÓ PHẢI LÀ URL KHÔNG
    if (isValidURL(message)) {
      console.log("🔗 Phát hiện URL - chuyển sang quy trình 2 bước");
      
      try {
        const urlAnalysis = await analyzeURL(message, message);
        
        const responseData: ApiResponse = {
          success: true,
          analysis: urlAnalysis,
          originalText: message,
          twoStepProcess: true,
          originalUrl: message
        };

        // Thêm thông tin về quy trình 2 bước nếu có
        if (urlAnalysis.twoStepProcess) {
          responseData.statistics = {
            analysisMode: "Two-Step URL Analysis",
            originalUrl: message,
            sourcesAnalyzed: urlAnalysis.sourcesAnalyzed || 0,
            identifiedTitle: urlAnalysis.identifiedTitle || "Không xác định được",
            keyTopics: urlAnalysis.keyTopics || [],
            searchQueries: urlAnalysis.searchQueries || [],
            twoStepEnabled: true
          };
        } else {
          responseData.statistics = {
            analysisMode: "Basic URL Analysis",
            originalUrl: message,
            sourcesAnalyzed: urlAnalysis.sourcesAnalyzed || 0,
            twoStepEnabled: false,
            note: "Cần Google API để bật quy trình 2 bước"
          };
        }

        res.json(responseData);
        return;
        
      } catch (error) {
        console.error("❌ Lỗi khi phân tích URL:", error);
        res.status(500).json({
          error: "Không thể phân tích URL được cung cấp",
          details: (error as Error).message,
          url: message
        });
        return;
      }
    }

    // TIẾP TỤC VỚI PHÂN TÍCH THÔNG THƯỜNG
    console.log("📝 Phân tích text thông thường");

    // BƯỚC 1: Tìm kiếm Google (nếu có API key)
    let allSearchResults: SearchResult[] = [];
    let webContents: WebContent[] = [];
    let webAnalysis: WebAnalysisResult | null = null;
    
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      console.log("🔍 Bước 1: Tìm kiếm thông tin...");
      const searchQueries = [
        message.substring(0, 200),
        `"${message.substring(0, 100)}"`,
        `${message.substring(0, 100)} fact check`,
        `${message.substring(0, 100)} tin tức`,
        `${message.substring(0, 100)} sự thật`
      ];

      for (const query of searchQueries.slice(0, 4)) {
        try {
          const searchResults = await searchGoogleAPI(query, 8);
          allSearchResults = allSearchResults.concat(searchResults);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log("Lỗi search:", (error as Error).message);
        }
      }

      // Loại bỏ trùng lặp và lọc URL đáng tin cậy
      const uniqueResults = allSearchResults.filter((result, index, self) => 
        index === self.findIndex(r => r.link === result.link)
      );
      
      const trustedResults = filterTrustedUrls(uniqueResults);
      console.log(`✅ Tìm thấy ${trustedResults.length} kết quả đáng tin cậy`);

      // BƯỚC 2: Fetch nội dung từ các trang web
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
    }

    // BƯỚC 4: Phân tích chính với Gemini (luôn chạy)
    console.log("🤖 Phân tích chính với Gemini AI...");
    
    let enhancedPrompt: string;
    if (webAnalysis && webContents.filter(c => c.success).length > 0) {
      // Prompt với dữ liệu web
      const webContentSummary = webContents
        .filter(c => c.success)
        .map(c => `• ${c.url}: ${c.content.substring(0, 300)}...`)
        .join('\n');
      
      enhancedPrompt = `
Bạn là một chuyên gia phân tích tin tức với khả năng tích hợp thông tin từ nhiều nguồn, hiện tại là tháng ${thang} năm ${nam}. 

TUYÊN BỐ CẦN PHÂN TÍCH: "${message}"

THÔNG TIN BỔ SUNG TỪ WEB (${webContents.filter(c => c.success).length} nguồn):
${webContentSummary}

KẾT QUẢ PHÂN TÍCH WEB:
${JSON.stringify(webAnalysis, null, 2)}

Hãy phân tích tổng hợp và xác định:
1. Đây có phải là tin giả (fake news) không?
2. Mức độ tin cậy (từ 0-100%)
3. Lý do chi tiết dựa trên cả AI analysis và web evidence
4. Các dấu hiệu nhận biết
5. So sánh với thông tin tìm được từ web

Trả lời theo định dạng JSON:
{
  "isFakeNews": true/false,
  "confidence": số từ 0-100,
  "reason": "lý do chi tiết tích hợp web evidence",
  "indicators": ["dấu hiệu 1", "dấu hiệu 2"],
  "recommendation": "khuyến nghị cho người đọc",
  "webEvidenceUsed": true/false,
  "sourcesAnalyzed": ${webContents.filter(c => c.success).length}
}
`;
    } else {
      // Prompt cơ bản khi không có web data
      enhancedPrompt = `
Bạn là một chuyên gia phân tích tin tức, hiện tại là tháng ${thang} năm ${nam}. Hãy phân tích đoạn văn bản sau và xác định:
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
  "recommendation": "khuyến nghị cho người đọc",
  "webEvidenceUsed": false,
  "sourcesAnalyzed": 0
}
`;
    }

    // Gọi Gemini API
    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response từ Gemini
    let analysisResult: AnalysisResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Không thể parse JSON");
      }
    } catch (parseError) {
      // Nếu không parse được JSON, tạo response mặc định
      analysisResult = {
        isFakeNews: false,
        confidence: 50,
        reason: text.substring(0, 200) + "...",
        indicators: ["Cần phân tích thêm"],
        recommendation: "Hãy kiểm tra từ nhiều nguồn khác nhau",
        webEvidenceUsed: webAnalysis ? true : false,
        sourcesAnalyzed: webContents.filter(c => c.success).length
      };
    }

    console.log("✅ Hoàn thành phân tích");

    // Response với dữ liệu đầy đủ
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
        totalSitesFound: allSearchResults.length,
        sitesAnalyzed: webContents.filter(c => c.success).length,
        totalContentLength: webContents.filter(c => c.success).reduce((sum, content) => sum + content.length, 0),
        sourceDomains: [...new Set(webContents.filter(c => c.success).map(content => content.url.split('/')[2]))]
      };
    }

    res.json(responseData);

  } catch (error) {
    console.error("❌ Lỗi khi phân tích:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi phân tích nội dung",
      details: (error as Error).message
    });
  }
});


// Export type và function declarations
export type { AnalysisResult };

// Route test API
app.get("/api/test", (req: Request, res: Response): void => {
  res.json({
    message: "Backend đang hoạt động bình thường!",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    googleSearchConfigured: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID),
    features: [
      "🔗 Two-Step URL Analysis Process",
      "🔍 Step 1: Search based on URL keywords", 
      "📰 Step 2: Extract title & content from sources",
      "🔍 Step 3: Search again with extracted content",
      "📊 Step 4: Cross-reference multiple sources", 
      "📝 Text-based fact checking", 
      "🌐 Deep web content fetching",
      "🛡️ Trusted domain filtering",
      "🤖 AI-powered comprehensive analysis"
    ],
    analysisMode: {
      "URL Input": "Quy trình 2 bước: Search URL keywords → Fetch & analyze → Search với title/content → Final analysis",
      "Text Input": "Fact-check văn bản + tìm kiếm bổ sung",
      "Two-Step Process": process.env.GOOGLE_SEARCH_API_KEY ? "Enabled" : "Disabled - cần Google API"
    },
    webCrawlingEnabled: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID),
    timestamp: new Date().toISOString()
  });
});

// Routes quản lý lịch sử
app.get("/api/history", (req: Request, res: Response): void => {
  res.json({
    success: true,
    history: analysisHistory
  });
});

app.delete("/api/history", (req: Request, res: Response): void => {
  try {
    analysisHistory = [];
    res.json({
      success: true,
      message: "Đã xóa toàn bộ lịch sử thành công",
      historyCount: 0
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa lịch sử:", error);
    res.status(500).json({
      success: false,
      error: "Không thể xóa lịch sử"
    });
  }
});

app.delete("/api/history/:id", (req: Request, res: Response): void => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (!itemId) {
      res.status(400).json({
        success: false,
        error: "ID không hợp lệ"
      });
      return;
    }
    
    const initialLength = analysisHistory.length;
    analysisHistory = analysisHistory.filter(item => item.id !== itemId);
    
    if (analysisHistory.length === initialLength) {
      res.status(404).json({
        success: false,
        error: "Không tìm thấy item với ID này"
      });
      return;
    }
    
    res.json({
      success: true,
      message: "Đã xóa item thành công",
      deletedId: itemId,
      remainingCount: analysisHistory.length
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa item:", error);
    res.status(500).json({
      success: false,
      error: "Không thể xóa item"
    });
  }
});

app.get("/api/history/stats", (req: Request, res: Response): void => {
  try {
    const total = analysisHistory.length;
    const fakeCount = analysisHistory.filter(item => item.result.isFakeNews).length;
    const realCount = total - fakeCount;
    const urlAnalyses = analysisHistory.filter(item => item.analysisType.includes('URL')).length;
    const textAnalyses = total - urlAnalyses;
    const twoStepAnalyses = analysisHistory.filter(item => item.twoStepProcess).length;
    
    const avgConfidence = total > 0 
      ? Math.round(analysisHistory.reduce((sum, item) => sum + item.result.confidence, 0) / total)
      : 0;
    
    // Thống kê theo thời gian
    const today = new Date().toDateString();
    const todayCount = analysisHistory.filter(item => 
      new Date(item.timestamp).toDateString() === today
    ).length;
    
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const weekCount = analysisHistory.filter(item => 
      new Date(item.timestamp) >= thisWeek
    ).length;
    
    const thisMonth = new Date();
    thisMonth.setMonth(thisMonth.getMonth() - 1);
    const monthCount = analysisHistory.filter(item => 
      new Date(item.timestamp) >= thisMonth
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
    console.error("❌ Lỗi khi lấy thống kê:", error);
    res.status(500).json({
      success: false,
      error: "Không thể lấy thống kê"
    });
  }
});

// Middleware lưu lịch sử
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && (req.path === '/api/analyze' || req.path === '/api/analyze-url')) {
    const originalJson = res.json;
    res.json = function (data: any) {
      if (data.success && data.analysis) {
        const historyEntry: HistoryEntry = {
          id: Date.now(),
          text: data.originalText,
          result: data.analysis,
          sourcesAnalyzed: data.statistics ? data.statistics.sourcesAnalyzed : 0,
          analysisType: data.twoStepProcess ? 'Two-Step URL Analysis' : 'Text Analysis',
          timestamp: new Date().toISOString()
        };

// Export type để có thể sử dụng ở nơi khác
        // Thêm thông tin URL analysis nếu có
        if (data.twoStepProcess) {
          historyEntry.originalUrl = data.originalUrl;
          historyEntry.identifiedTitle = data.analysis.identifiedTitle;
          historyEntry.keyTopics = data.analysis.keyTopics;
          historyEntry.twoStepProcess = true;
        }

        analysisHistory.unshift(historyEntry);

        // Giữ tối đa 50 records
        if (analysisHistory.length > 50) {
          analysisHistory = analysisHistory.slice(0, 50);
        }
      }
      originalJson.call(this, data);
    };
  }
  next();
});

app.listen(port, () => {
  console.log(`✅ Backend đang chạy tại http://localhost:${port}`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? 'Đã cấu hình' : 'Chưa cấu hình'}`);
  console.log(`🔍 Google Search API: ${process.env.GOOGLE_SEARCH_API_KEY ? 'Đã cấu hình' : 'Chưa cấu hình'}`);
  console.log(`🌐 Web Content Analysis: ${process.env.GOOGLE_SEARCH_API_KEY ? 'Enabled' : 'Disabled - chỉ dùng Gemini AI'}`);
});

/**
 * Gọi Gemini API để phân tích nội dung tin tức (compatibility function)
 * @param message Nội dung cần phân tích
 * @returns Kết quả phân tích dưới dạng JSON
 */
export const callGeminiAPI = async (message: string): Promise<AnalysisResult> => {
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
}
`;

  console.log("Gọi đến Gemini...");
  const result = await model.generateContent(prompt);
  console.log("Đã có result.");
  const response = result.response;
  const text = response.text();

  try {
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
    // Nếu không parse được, trả về kết quả mặc định
    return {
      isFakeNews: false,
      confidence: 50,
      reason: text.substring(0, 200) + "...",
      indicators: ["Cần phân tích thêm"],
      recommendation: "Hãy kiểm tra từ nhiều nguồn khác nhau",
      webEvidenceUsed: false,
      sourcesAnalyzed: 0
    };
  }
};
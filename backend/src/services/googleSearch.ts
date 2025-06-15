// backend/src/services/googleSearch.ts
// 🔍 Tích hợp Google Custom Search API và xử lý URL

import axios from 'axios';
import { SearchResult } from '../types/interfaces';

/**
 * Tìm kiếm bằng Google Custom Search API
 * Trả về mảng kết quả tìm kiếm với tiêu đề, snippet và URL
 */
export async function searchGoogleAPI(query: string, maxResults: number = 10): Promise<SearchResult[]> {
  try {
    const searchUrl = 'https://www.googleapis.com/customsearch/v1';
    
    const params = {
      key: process.env.GOOGLE_SEARCH_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: query,
      num: Math.min(maxResults, 10),
      safe: 'medium',
      lr: 'lang_vi|lang_en'  // Kết quả tiếng Việt và tiếng Anh
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
    console.error('❌ Lỗi khi gọi Google Search API:', (error as any).response?.data || (error as Error).message);
    return [];
  }
}

/**
 * Lọc kết quả tìm kiếm để ưu tiên các nguồn tin đáng tin cậy
 * Loại bỏ các domain chất lượng thấp và sắp xếp theo độ tin cậy
 */
export function filterTrustedUrls(searchResults: SearchResult[]): SearchResult[] {
  // Các domain tin cậy - được ưu tiên trong kết quả
  const trustedDomains: string[] = [
    'wikipedia.org',
    'gov.vn',           // Trang chính phủ Việt Nam
    'edu.vn',           // Trang giáo dục Việt Nam
    'bbc.com',
    'cnn.com',
    'reuters.com',
    'ap.org',
    'vnexpress.net',    // Báo Việt Nam
    'tuoitre.vn',
    'thanhnien.vn',
    'vietnamnet.vn',
    'dantri.com.vn',
    'vietNamNews.vn',
    'bloomberg.com',
    'wsj.com',
    'nytimes.com',
    'theguardian.com',
    'factcheck.org',    // Trang fact-check
    'snopes.com',
    'politifact.com'
  ];
  
  // Các domain chất lượng thấp cần lọc bỏ
  const lowQualityDomains: string[] = [
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'reddit.com'
  ];
  
  // Lọc bỏ các domain chất lượng thấp
  const filteredResults = searchResults.filter(result => {
    const domain = result.displayLink.toLowerCase();
    
    // Loại bỏ domain chất lượng thấp
    if (lowQualityDomains.some(bad => domain.includes(bad))) {
      return false;
    }
    
    return true;
  });
  
  // Sắp xếp theo độ tin cậy (domain tin cậy lên đầu)
  return filteredResults.sort((a, b) => {
    const aTrusted = trustedDomains.some(trusted => a.displayLink.toLowerCase().includes(trusted));
    const bTrusted = trustedDomains.some(trusted => b.displayLink.toLowerCase().includes(trusted));
    
    if (aTrusted && !bTrusted) return -1;  // a lên trước
    if (!aTrusted && bTrusted) return 1;   // b lên trước
    return 0;  // giữ thứ tự ban đầu
  });
}

/**
 * Kiểm tra xem chuỗi có phải là URL hợp lệ không
 */
export function isValidURL(string: string): boolean {
  try {
    const url = new URL(string.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * Trích xuất từ khóa có ý nghĩa từ đường dẫn URL
 * Xử lý URL tiếng Việt và các cấu trúc URL khác nhau
 */
export function extractKeywordsFromURL(urlPath: string): string {
  try {
    console.log("🔍 Đang phân tích URL:", urlPath);
    
    // Giải mã URL trước để xử lý ký tự mã hóa
    const decodedPath = decodeURIComponent(urlPath);
    console.log("🔍 URL đã giải mã:", decodedPath);
    
    // Tách URL thành các phần
    const pathParts = decodedPath.split('/');
    
    // Tìm phần có khả năng chứa nội dung có ý nghĩa nhất
    let bestKeywords = '';
    let maxScore = 0;
    
    for (const part of pathParts) {
      if (part.length < 5) continue; // Bỏ qua phần quá ngắn
      
      let score = 0;
      
      // Tiêu chí chấm điểm:
      
      // 1. Chứa ký tự tiếng Việt (giá trị cao)
      if (/[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(part)) {
        score += 10;
      }
      
      // 2. Có nhiều từ (phân tách bằng dấu gạch ngang/gạch dưới)
      const wordCount = part.split(/[-_]/).length;
      score += wordCount;
      
      // 3. Độ dài hợp lý (không quá ngắn, không quá dài)
      if (part.length > 20 && part.length < 200) {
        score += 5;
      }
      
      // 4. Không chứa tham số truy vấn
      if (!part.includes('=') && !part.includes('?') && !part.includes('&')) {
        score += 3;
      }
      
      // 5. Không phải ID ngẫu nhiên (toàn số/chữ)
      if (!/^[a-zA-Z0-9]{10,}$/.test(part)) {
        score += 2;
      }
      
      console.log(`🔍 Phần "${part.substring(0, 50)}..." điểm: ${score}`);
      
      if (score > maxScore) {
        maxScore = score;
        bestKeywords = part;
      }
    }
    
    if (bestKeywords) {
      // Làm sạch từ khóa tốt nhất
      let cleanKeywords = bestKeywords
        .replace(/[-_]/g, ' ')                    // Thay dấu gạch ngang/gạch dưới bằng khoảng trắng
        .replace(/%[0-9A-F]{2}/gi, ' ')          // Loại bỏ phần mã hóa URL còn sót lại
        .replace(/[^a-zA-Z0-9\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/gi, ' ')
        .replace(/\s+/g, ' ')                    // Nhiều khoảng trắng → một khoảng trắng
        .trim();
      
      console.log(`✅ Từ khóa tốt nhất: "${cleanKeywords}"`);
      return cleanKeywords;
    }
    
    // Chiến lược dự phòng
    const domain = urlPath.split('/')[2] || '';
    const lastPath = pathParts[pathParts.length - 1] || '';
    
    let fallbackKeywords = '';
    
    // Xử lý đặc biệt cho URL MSN.com
    if (domain.includes('msn.com')) {
      const categoryIndex = pathParts.findIndex(part => 
        ['lifestyle', 'sports', 'news', 'entertainment', 'health', 'technology'].includes(part)
      );
      
      if (categoryIndex >= 0 && pathParts[categoryIndex + 1]) {
        fallbackKeywords = `${pathParts[categoryIndex]} ${pathParts[categoryIndex + 1]}`;
      }
    }
    
    // Dự phòng chung - làm sạch phần cuối đường dẫn
    if (!fallbackKeywords) {
      fallbackKeywords = lastPath
        .replace(/[^a-zA-Z0-9\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    console.log(`🔄 Từ khóa dự phòng: "${fallbackKeywords}"`);
    return fallbackKeywords || 'tin tức mới';  // Dự phòng mặc định
    
  } catch (error) {
    console.error("❌ Lỗi trích xuất từ khóa từ URL:", error);
    return 'tin tức';  // Dự phòng an toàn
  }
}
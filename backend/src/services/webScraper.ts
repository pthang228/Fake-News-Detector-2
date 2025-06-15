// backend/src/services/webScraper.ts
// 🌐 Tiện ích thu thập và trích xuất nội dung web

import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { WebContent } from '../types/interfaces';

// Cấu hình User-Agent để tránh bị chặn
const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

/**
 * Lấy User-Agent ngẫu nhiên để tránh phát hiện
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Trích xuất nội dung văn bản sạch từ HTML
 * Loại bỏ quảng cáo, điều hướng và các phần tử không phải nội dung
 */
export function extractTextFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Loại bỏ các phần tử không cần thiết
    $('script, style, nav, footer, header, aside, .advertisement, .ads, .social-share, .comments, .sidebar').remove();
    
    let mainContent = '';
    
    // Thử tìm nội dung chính bằng các selector phổ biến
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
    
    // Tìm phần tử nội dung tốt nhất
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
    
    // Dự phòng về văn bản body nếu không tìm thấy nội dung chính
    if (!mainContent || mainContent.length < 100) {
      const bodyText = $('body').text().trim();
      if (bodyText.length > 0) {
        mainContent = bodyText;
      }
    }
    
    // Dự phòng cuối cùng - lấy tất cả văn bản
    if (!mainContent || mainContent.length < 50) {
      mainContent = $.text().trim();
    }
    
    // Làm sạch văn bản
    if (mainContent) {
      mainContent = mainContent
        .replace(/\s+/g, ' ')        // Nhiều khoảng trắng → một khoảng trắng
        .replace(/\n+/g, '\n')       // Nhiều xuống dòng → một xuống dòng
        .replace(/\t+/g, ' ')        // Tab → khoảng trắng
        .trim();
    }
    
    return mainContent || '';
    
  } catch (error) {
    console.error("❌ Lỗi khi trích xuất văn bản từ HTML:", (error as Error).message);
    return '';
  }
}

/**
 * Trích xuất tiêu đề từ tài liệu HTML
 */
export function extractTitleFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    return $('title').text().trim() || $('h1').first().text().trim() || '';
  } catch (error) {
    return '';
  }
}

/**
 * Tải và trích xuất nội dung từ URL web
 * Bao gồm logic thử lại và trích xuất nội dung dự phòng
 */
export async function fetchWebContent(url: string, maxRetries: number = 1): Promise<WebContent> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 Đang tải nội dung từ: ${url} (lần thử ${attempt})`);
      
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
        
        // Nếu có nội dung tốt, trả về
        if (textContent && textContent.length > 50) {
          console.log(`✅ Tải thành công: ${textContent.length} ký tự từ ${url}`);
          return {
            url: url,
            content: textContent,
            title: title || 'Không có tiêu đề',
            success: true,
            length: textContent.length
          };
        } else {
          // Thử trích xuất nội dung dự phòng từ thẻ meta
          console.log(`⚠️ Nội dung quá ngắn: ${textContent?.length || 0} ký tự từ ${url}`);
          
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
            console.log(`✅ Sử dụng nội dung dự phòng: ${fallbackContent.length} ký tự từ ${url}`);
            return {
              url: url,
              content: fallbackContent,
              title: title || h1Text || 'Không có tiêu đề',
              success: true,
              length: fallbackContent.length,
              note: 'Sử dụng meta data - không thể trích xuất nội dung chính'
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
      
      // Đợi trước khi thử lại (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  // Điều này không bao giờ được đạt tới, nhưng TypeScript yêu cầu
  return {
    url: url,
    content: '',
    title: '',
    success: false,
    length: 0,
    error: 'Vượt quá số lần thử tối đa'
  };
}
// backend/src/routes/history.routes.ts
// 📊 Routes cho quản lý lịch sử

import { Router } from 'express';
import { historyController } from '../controllers/history.controller';

const router = Router();

// 📊 CÁC ENDPOINT QUẢN LÝ LỊCH SỬ

/**
 * Lấy tất cả lịch sử với các tùy chọn filter và phân trang
 * GET /api/history
 * Query params:
 * - search: tìm kiếm theo nội dung
 * - filter: lọc theo loại (all, fake, real, url, text)
 * - sortBy: sắp xếp theo (timestamp, confidence, analysisType)
 * - order: thứ tự (asc, desc)
 * - page: trang hiện tại
 * - pageSize: số mục mỗi trang
 */
router.get('/', historyController.getAllHistory.bind(historyController));

/**
 * Lấy thống kê lịch sử
 * GET /api/history/stats
 */
router.get('/stats', historyController.getHistoryStatistics.bind(historyController));

/**
 * Tìm kiếm trong lịch sử
 * GET /api/history/search
 * Query params:
 * - q: từ khóa tìm kiếm
 * - type: loại phân tích (url, text)
 * - result: kết quả (fake, real)
 */
router.get('/search', historyController.searchHistory.bind(historyController));

/**
 * Export lịch sử ra file JSON
 * GET /api/history/export
 */
router.get('/export', historyController.exportHistory.bind(historyController));

/**
 * Lấy một mục lịch sử cụ thể
 * GET /api/history/:id
 */
router.get('/:id', historyController.getHistoryItem.bind(historyController));

/**
 * Import lịch sử từ file JSON
 * POST /api/history/import
 * Body: { data: string } - JSON string chứa dữ liệu lịch sử
 */
router.post('/import', historyController.importHistory.bind(historyController));

/**
 * Xóa tất cả lịch sử
 * DELETE /api/history
 */
router.delete('/', historyController.clearAllHistory.bind(historyController));

/**
 * Xóa mục lịch sử cụ thể
 * DELETE /api/history/:id
 */
router.delete('/:id', historyController.deleteHistoryItem.bind(historyController));

export default router;  
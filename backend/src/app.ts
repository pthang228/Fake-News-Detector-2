import express, { NextFunction, Request, Response } from 'express';
import authRouter from './routes/auth.routes';  // router dùng controller login
import cors from 'cors';
import 'dotenv/config';
import geminiRouter from './routes/gemini.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Không cần khởi tạo lại admin ở đây vì đã làm trong services/firebase.ts

app.use('/', authRouter);
app.use('/', geminiRouter);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Lỗi server:', err);
  res.status(500).json({ message: 'Lỗi server nội bộ' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server chạy port ${PORT}`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? 'Đã cấu hình' : 'Chưa cấu hình'}`);
});

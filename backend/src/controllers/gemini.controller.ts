import { Request, Response } from 'express';
import { callGeminiAPI } from '../services/gemini.service';

export const analyzePrompt = async (req: Request, res: Response) => {
    const { prompt } = req.body;
    console.log(prompt);
    if (!prompt) {
        return res.status(400).json({ message: 'Thiếu prompt' });
    }

    try {
        const result = await callGeminiAPI(prompt);
        
        res.status(200).json( result );
    } catch (error) {
        res.status(500).json({ message: 'Lỗi phân tích prompt' });
    }
};

import { Request, Response, NextFunction } from 'express';
import { firebaseAdmin } from '../services/firebase.services';

export const verifyFirebaseToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
      res.status(401).json({ message: 'Thiếu token xác thực' });
      return; // Thay đổi này
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Lỗi xác thực Firebase:', error);
    res.status(401).json({ message: 'Token không hợp lệ' });
    return; // Thêm dòng này
  }
};
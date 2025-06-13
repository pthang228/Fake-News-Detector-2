import { RequestHandler } from 'express';

export const login: RequestHandler = (req, res) => {
  const user = (req as any).user;

  const role = user.role || 'user';
  console.log(role, 'đang sử dụng.');

  res.status(200).json({
    message: 'Xác thực thành công từ Firebase',
    displayName: user.name,
    email: user.email,
    name: user.name,
    uid: user.uid,
    role,
  });
};

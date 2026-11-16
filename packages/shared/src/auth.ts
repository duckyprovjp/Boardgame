import { z } from 'zod';
import { AVATAR_IDS } from './avatars';

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, 'Tên người dùng phải có ít nhất 3 ký tự')
  .max(20, 'Tên người dùng tối đa 20 ký tự')
  .regex(/^[a-zA-Z0-9_]+$/, 'Tên người dùng chỉ gồm chữ cái, số và dấu gạch dưới');

export const PasswordSchema = z
  .string()
  .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
  .max(100, 'Mật khẩu quá dài');

export const AvatarIdSchema = z.enum(AVATAR_IDS);

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: PasswordSchema,
  username: UsernameSchema,
  avatarId: AvatarIdSchema.default('fox'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const GuestLoginSchema = z.object({
  username: UsernameSchema.optional(),
  avatarId: AvatarIdSchema.default('fox'),
});

export type GuestLoginInput = z.infer<typeof GuestLoginSchema>;

export const UpdateProfileSchema = z.object({
  username: UsernameSchema,
  avatarId: AvatarIdSchema,
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export interface AuthUser {
  id: string;
  username: string;
  avatarId: string;
  isGuest: boolean;
  email?: string | null;
}

export interface PublicUser {
  id: string;
  username: string;
  avatarId: string;
  isGuest: boolean;
}

import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Must be a valid email address"),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a digit"),
  fullName: z.string().trim().min(1, "Full name is required").max(200),
});
export type RegisterBody = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginBody = z.infer<typeof loginSchema>;

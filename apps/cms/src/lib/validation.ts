import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const contentAreaSchema = z.object({
  value: z.string(),
})

export const contentBulkSchema = z.record(z.string(), z.string().max(10000))

export const teamMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.string().min(1, 'Role is required').max(200),
  bio: z.string().max(5000, 'Bio must be 5000 characters or less').optional().default(''),
  type: z.enum(['founder', 'fund_advisor', 'stewardship_advisor']),
  order: z.number().int().optional().default(0),
  imageUrl: z.string().optional().default(''),
  linkedinUrl: z.string().optional().default(''),
})

export const newsPostSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1, 'Title is required').max(300),
  author: z.string().optional().default('Green Room Partners'),
  publishedAt: z.coerce.date().optional(),
  monthKey: z.string().optional().default(''),
  summary: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(['draft', 'published']).optional().default('draft'),
  pages: z
    .array(
      z.object({
        heading: z.string().optional().default(''),
        body: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
})

export const mediaSchema = z.object({
  alt: z.string().max(200, 'Alt text must be 200 characters or less').optional().default(''),
})

export const linkedInPostSchema = z.object({
  embedHtml: z.string().min(1, 'Embed HTML is required'),
  caption: z.string().optional(),
  postDate: z.coerce.date().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ContentBulkInput = z.infer<typeof contentBulkSchema>
export type TeamMemberInput = z.infer<typeof teamMemberSchema>
export type NewsPostInput = z.infer<typeof newsPostSchema>
export type MediaInput = z.infer<typeof mediaSchema>
export type LinkedInPostInput = z.infer<typeof linkedInPostSchema>

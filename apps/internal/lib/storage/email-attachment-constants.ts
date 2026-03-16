export const EMAIL_ATTACHMENT_BUCKET = 'email-attachments'
export const MAX_EMAIL_ATTACHMENT_FILE_SIZE = 25 * 1024 * 1024 // 25MB (Gmail limit)
export const ACCEPTED_EMAIL_ATTACHMENT_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  'text/html',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  // Videos (common formats)
  'video/mp4',
  'video/quicktime',
] as const

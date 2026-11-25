export type FeedbackActionResult = {
  error?: string
}

export type TurnIntoTaskResult =
  | { taskId: string; href: string | null; error?: undefined }
  | { error: string; taskId?: undefined; href?: undefined }

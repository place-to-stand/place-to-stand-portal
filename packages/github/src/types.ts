export interface GitHubInstallation {
  id: number
  account: {
    login: string
    id: number
    avatar_url: string
    type: string // 'Organization' | 'User'
  }
  app_id: number
  target_type: string
  permissions: Record<string, string>
  events: string[]
  repository_selection: 'all' | 'selected'
  created_at: string
  updated_at: string
  suspended_at: string | null
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  default_branch: string
  private: boolean
  description: string | null
  html_url: string
}

export interface InstallationToken {
  token: string
  expires_at: string
  permissions: Record<string, string>
}

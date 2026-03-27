// ─── Repos / Workspace ────────────────────────────────────────────────────────

export interface RepoInfo {
  id: string
  name: string
  path: string
  branch: string
  lastCommitHash: string
  lastCommitMessage: string
  lastCommitDate: string
  ahead: number
  behind: number
  isDirty: boolean
  hasRemote: boolean
  scanDir: string
  diskSizeKb: number
  githubOwner: string
  githubRepo: string
  error?: string
}

export interface ReposResponse {
  repos: RepoInfo[]
  scanDirs: string[]
  lastUpdated: string
  error?: string
}

export interface FsEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

export interface FsResponse {
  entries: FsEntry[]
  path: string
  error?: string
}

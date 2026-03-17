export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
  ext?: string
}

export interface TreeRoot {
  id: string
  label: string
  path: string
  icon?: string
}

export const TREE_ROOTS: TreeRoot[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    path: process.env.WORKSPACE_PATH ?? '',
    icon: 'folder-code'
  },
  {
    id: 'claude-workspace',
    label: 'CLAUDE Workspace',
    path: process.env.CLAUDE_PATH ?? '',
    icon: 'brain'
  }
]

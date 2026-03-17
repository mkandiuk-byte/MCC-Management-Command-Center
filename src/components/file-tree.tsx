"use client"

import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, File,
  FileText, FileCode, FileJson, Search, X, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FileNode } from "@/lib/types"

const TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.ts', '.tsx', '.js', '.jsx',
  '.py', '.go', '.rs', '.json', '.yaml', '.yml', '.toml',
  '.sh', '.env', '.css', '.html', '.xml', '.sql', '.mjs', '.cjs'
])

function getFileIcon(node: FileNode) {
  if (node.type === 'directory') return null
  const ext = node.ext?.toLowerCase()
  switch (ext) {
    case '.ts': case '.tsx': case '.js': case '.jsx': case '.py': case '.go': case '.rs':
      return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />
    case '.md': case '.mdx': case '.txt':
      return <FileText className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
    case '.json': case '.yaml': case '.yml': case '.toml':
      return <FileJson className="h-3.5 w-3.5 text-orange-400 shrink-0" />
    default:
      return <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  }
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

interface TreeNodeProps {
  node: FileNode
  depth: number
  filter: string
  onSelectFile: (node: FileNode) => void
  selectedPath?: string
}

function TreeNode({ node, depth, filter, onSelectFile, selectedPath }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false)

  const matchesFilter = (n: FileNode): boolean => {
    if (!filter) return true
    if (n.name.toLowerCase().includes(filter.toLowerCase())) return true
    if (n.children) return n.children.some(matchesFilter)
    return false
  }

  if (filter && !matchesFilter(node)) return null

  if (node.type === 'directory') {
    const hasChildren = node.children && node.children.length > 0
    return (
      <div>
        <button
          className={cn(
            "flex items-center gap-1.5 w-full text-left py-0.5 px-2 rounded text-sm hover:bg-accent/50 transition-colors",
            "text-foreground"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
            {hasChildren ? (
              expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : (
              <span className="w-3" />
            )}
          </span>
          {expanded
            ? <FolderOpen className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
            : <Folder className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          }
          <span className="truncate font-medium">{node.name}</span>
          {hasChildren && (
            <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1 shrink-0">
              {node.children!.length}
            </Badge>
          )}
        </button>
        {expanded && hasChildren && (
          <div>
            {node.children!.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                filter={filter}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      className={cn(
        "flex items-center gap-1.5 w-full text-left py-0.5 px-2 rounded text-sm hover:bg-accent/50 transition-colors",
        selectedPath === node.path && "bg-accent"
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onSelectFile(node)}
    >
      <span className="w-3.5 shrink-0" />
      {getFileIcon(node)}
      <span className="truncate text-muted-foreground">{node.name}</span>
      {node.size && (
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
          {formatSize(node.size)}
        </span>
      )}
    </button>
  )
}

interface FileViewerProps {
  file: FileNode
  onClose: () => void
}

function FileViewer({ file, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isMarkdown = file.ext?.toLowerCase() === '.md' || file.ext?.toLowerCase() === '.mdx'
  const isText = TEXT_EXTENSIONS.has(file.ext?.toLowerCase() ?? '')

  useEffect(() => {
    if (!isText) {
      setLoading(false)
      return
    }
    setLoading(true)
    setContent(null)
    setError(null)
    fetch(`/api/fs/content?path=${encodeURIComponent(file.path)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setContent(data.content)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [file.path, isText])

  return (
    <div className="flex flex-col h-full border-l overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-muted/30">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {getFileIcon(file)}
          <span className="text-sm font-medium truncate">{file.name}</span>
          {file.size && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
              {formatSize(file.size)}
            </Badge>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && !isText && (
          <div className="p-4 space-y-2 text-xs text-muted-foreground">
            <div><span className="font-medium text-foreground">Type:</span> {file.ext || 'unknown'}</div>
            {file.size && <div><span className="font-medium text-foreground">Size:</span> {formatSize(file.size)}</div>}
            <div>
              <span className="font-medium text-foreground">Path:</span>
              <p className="mt-1 break-all font-mono text-[10px]">{file.path}</p>
            </div>
          </div>
        )}

        {!loading && !error && isText && content !== null && (
          isMarkdown ? (
            <div className="p-4 markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {content}
            </pre>
          )
        )}
      </ScrollArea>
    </div>
  )
}

interface FileTreeProps {
  rootPath: string
  rootLabel: string
}

export function FileTree({ rootPath, rootLabel }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/fs?path=${encodeURIComponent(rootPath)}&maxDepth=4`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setTree(data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [rootPath])

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6" style={{ width: `${60 + (i * 7) % 40}%` }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error loading tree: {error}
      </div>
    )
  }

  if (!tree) return null

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter files..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
          {filter && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setFilter("")}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className={cn(selectedFile ? "w-72 shrink-0" : "flex-1 min-w-0")}>
          <div className="p-2">
            {tree.children?.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                filter={filter}
                onSelectFile={setSelectedFile}
                selectedPath={selectedFile?.path}
              />
            ))}
          </div>
        </ScrollArea>
        {selectedFile && (
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <FileViewer file={selectedFile} onClose={() => setSelectedFile(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

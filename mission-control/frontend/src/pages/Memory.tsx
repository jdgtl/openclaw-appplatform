import { useState, useEffect, useCallback } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { TextEditor } from "../components/TextEditor.js";
import { fetchJSON, putJSON } from "../lib/api.js";
import {
  Brain,
  FileText,
  BookOpen,
  Save,
  Loader2,
} from "lucide-react";

interface FileEntry {
  name: string;
  size: number;
  modified: string;
}

export function Memory() {
  const [workspaceFiles, setWorkspaceFiles] = useState<FileEntry[]>([]);
  const [memoryFiles, setMemoryFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<"workspace" | "memory">("workspace");
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const dirty = content !== originalContent;

  const loadFileList = useCallback(async () => {
    try {
      const [ws, mem] = await Promise.all([
        fetchJSON<{ files: FileEntry[] }>("/workspace/files"),
        fetchJSON<{ files: FileEntry[] }>("/workspace/memory"),
      ]);
      setWorkspaceFiles(ws.files);
      setMemoryFiles(mem.files);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFileList(); }, [loadFileList]);

  const handleSelectFile = async (name: string, section: "workspace" | "memory") => {
    setSelectedFile(name);
    setSelectedSection(section);
    try {
      const path = section === "workspace"
        ? `/workspace/files/${encodeURIComponent(name)}`
        : `/workspace/memory/${encodeURIComponent(name)}`;
      const data = await fetchJSON<{ content: string }>(path);
      setContent(data.content);
      setOriginalContent(data.content);
    } catch {
      const msg = "Error loading file";
      setContent(msg);
      setOriginalContent(msg);
    }
  };

  const handleSave = async () => {
    if (!selectedFile || selectedSection !== "workspace") return;
    setSaving(true);
    try {
      await putJSON(`/workspace/files/${encodeURIComponent(selectedFile)}`, { content });
      setOriginalContent(content);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const isReadonly = selectedSection === "memory";

  if (loading) {
    return (
      <PageShell title="Memory & Workspace">
        <div className="flex items-center justify-center h-64 text-text-tertiary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Memory & Workspace">
      <div className="flex gap-4 h-[calc(100vh-120px)]">
        {/* File browser */}
        <GlassCard delay={0} className="w-64 shrink-0 flex flex-col !p-0 overflow-hidden">
          <div className="p-3 border-b border-separator">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-accent" />
              <span className="text-sm font-medium text-text-primary">Files</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {/* Workspace files */}
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-text-quaternary uppercase tracking-wider px-2 mb-1">
                Workspace
              </p>
              {workspaceFiles.map((f) => (
                <button
                  key={`ws-${f.name}`}
                  onClick={() => handleSelectFile(f.name, "workspace")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                    selectedFile === f.name && selectedSection === "workspace"
                      ? "bg-accent/15 text-accent"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-control"
                  }`}
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{f.name}</span>
                  {selectedFile === f.name && selectedSection === "workspace" && dirty && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-warning shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Memory files */}
            <div>
              <p className="text-[11px] font-semibold text-text-quaternary uppercase tracking-wider px-2 mb-1">
                Memory (read-only)
              </p>
              {memoryFiles.map((f) => (
                <button
                  key={`mem-${f.name}`}
                  onClick={() => handleSelectFile(f.name, "memory")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                    selectedFile === f.name && selectedSection === "memory"
                      ? "bg-accent/15 text-accent"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-control"
                  }`}
                >
                  <BookOpen size={14} className="shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
              {memoryFiles.length === 0 && (
                <p className="text-xs text-text-quaternary px-2">No memory files</p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Editor */}
        <GlassCard delay={0.05} className="flex-1 flex flex-col !p-0 overflow-hidden">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-separator shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {selectedFile}
                  </span>
                  {isReadonly && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-control text-text-quaternary">
                      read-only
                    </span>
                  )}
                  {dirty && !isReadonly && (
                    <span className="h-2 w-2 rounded-full bg-warning" />
                  )}
                </div>
                {!isReadonly && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="flex items-center gap-1.5 text-sm text-white bg-accent px-3 py-1.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Save size={12} />
                    )}
                    Save
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TextEditor
                  value={content}
                  onChange={isReadonly ? undefined : setContent}
                  language="markdown"
                  rows={30}
                  readonly={isReadonly}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-quaternary text-sm">
              Select a file to view or edit
            </div>
          )}
        </GlassCard>
      </div>
    </PageShell>
  );
}

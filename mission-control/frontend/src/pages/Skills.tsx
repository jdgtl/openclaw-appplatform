import { useState, useEffect, useCallback } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { TextEditor } from "../components/TextEditor.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "../lib/api.js";
import {
  Puzzle,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";

interface SkillEntry {
  name: string;
  description: string;
  modified: string;
}

export function Skills() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const dirty = content !== originalContent;

  const loadSkills = useCallback(async () => {
    try {
      const data = await fetchJSON<{ skills: SkillEntry[] }>("/skills");
      setSkills(data.skills);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleSelectSkill = async (name: string) => {
    setSelectedSkill(name);
    try {
      const data = await fetchJSON<{ content: string }>(`/skills/${encodeURIComponent(name)}`);
      setContent(data.content);
      setOriginalContent(data.content);
    } catch {
      setContent("Error loading skill");
      setOriginalContent("");
    }
  };

  const handleSave = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    try {
      await putJSON(`/skills/${encodeURIComponent(selectedSkill)}`, { content });
      setOriginalContent(content);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (name: string) => {
    try {
      await postJSON("/skills", { name });
      await loadSkills();
      setShowNew(false);
      handleSelectSkill(name);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJSON(`/skills/${encodeURIComponent(deleteTarget)}`);
      if (selectedSkill === deleteTarget) {
        setSelectedSkill(null);
        setContent("");
        setOriginalContent("");
      }
      setDeleteTarget(null);
      await loadSkills();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <PageShell title="Skills">
        <div className="flex items-center justify-center h-64 text-text-tertiary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Skills">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-xs">
        <AlertTriangle size={12} />
        Gateway restart required after adding or removing skills
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        {/* Skill list */}
        <GlassCard delay={0} className="w-64 shrink-0 flex flex-col !p-0 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-separator">
            <div className="flex items-center gap-2">
              <Puzzle size={16} className="text-accent" />
              <span className="text-sm font-medium text-text-primary">Skills</span>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {skills.map((s) => (
              <div
                key={s.name}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                  selectedSkill === s.name
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-control"
                }`}
              >
                <button
                  onClick={() => handleSelectSkill(s.name)}
                  className="flex-1 text-left text-sm truncate"
                >
                  {s.name}
                </button>
                {selectedSkill === s.name && dirty && (
                  <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.name); }}
                  className="opacity-0 group-hover:opacity-100 text-text-quaternary hover:text-danger transition-all shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {skills.length === 0 && (
              <p className="text-xs text-text-quaternary px-2 py-4 text-center">
                No custom skills
              </p>
            )}
          </div>
        </GlassCard>

        {/* Editor */}
        <GlassCard delay={0.05} className="flex-1 flex flex-col !p-0 overflow-hidden">
          {selectedSkill ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-separator shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {selectedSkill}/SKILL.md
                  </span>
                  {dirty && (
                    <span className="h-2 w-2 rounded-full bg-warning" />
                  )}
                </div>
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
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TextEditor
                  value={content}
                  onChange={setContent}
                  language="markdown"
                  rows={30}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-quaternary text-sm">
              Select a skill to edit or create a new one
            </div>
          )}
        </GlassCard>
      </div>

      {/* New Skill Modal */}
      {showNew && <NewSkillModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Skill"
        message={`Delete skill "${deleteTarget}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}

function NewSkillModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (trimmed) onCreate(trimmed);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-window w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-separator">
          <h2 className="text-sm font-semibold text-text-primary">New Skill</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-tertiary font-medium">
              Skill name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-skill"
              className="bg-surface-input text-sm text-text-primary rounded-lg px-3 py-2 outline-none border border-border-subtle focus:border-accent transition-colors w-full"
              autoFocus
            />
            <span className="text-[10px] text-text-quaternary">
              Letters, numbers, hyphens, underscores only
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-secondary px-4 py-2 rounded-lg hover:bg-surface-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="text-sm text-white bg-accent px-4 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

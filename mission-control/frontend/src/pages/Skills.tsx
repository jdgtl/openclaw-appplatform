import { useState, useEffect, useCallback } from "react";
import { PageShell } from "../components/PageShell.js";
import { TextEditor } from "../components/TextEditor.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { StatusDot } from "../components/StatusDot.js";
import { Modal, FormLabel, FormInput, ModalActions } from "../components/Modal.js";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "../lib/api.js";
import {
  Puzzle,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface SkillEntry {
  name: string;
  description: string;
  modified: string;
}

const SKILL_EMOJIS: Record<string, string> = {
  clawdev: "\u{1F527}",
  "web-scraper": "\u{1F310}",
  "seo-auditor": "\u{1F4CA}",
  "email-composer": "\u{2709}\uFE0F",
  "image-optimizer": "\u{1F5BC}\uFE0F",
  "claude-code-runner": "\u{1F4BB}",
};

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
        <div className="flex items-center justify-center h-64 text-text-dim">
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

      <div className="flex gap-0 h-[calc(100vh-160px)] border border-border rounded-xl overflow-hidden">
        {/* Skill list */}
        <div className="w-64 shrink-0 bg-sidebar-bg border-r border-border flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Puzzle size={16} className="text-accent" />
              <span className="text-sm font-medium text-text">Skills</span>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {skills.map((s) => {
              const emoji = SKILL_EMOJIS[s.name] ?? "\u{2B50}";
              return (
                <div
                  key={s.name}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                    selectedSkill === s.name
                      ? "bg-accent-bg text-accent"
                      : "text-text-muted hover:text-text hover:bg-surface-hover"
                  }`}
                >
                  <span className="text-sm shrink-0">{emoji}</span>
                  <button
                    onClick={() => handleSelectSkill(s.name)}
                    className="flex-1 text-left text-sm truncate"
                  >
                    {s.name}
                  </button>
                  <StatusDot status="active" size={6} />
                  {selectedSkill === s.name && dirty && (
                    <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.name); }}
                    className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-danger transition-all shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {skills.length === 0 && (
              <p className="text-xs text-text-faint px-2 py-4 text-center">
                No custom skills
              </p>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col bg-bg">
          {selectedSkill ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">
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
            <div className="flex-1 flex items-center justify-center text-text-faint text-sm">
              Select a skill to edit or create a new one
            </div>
          )}
        </div>
      </div>

      {/* New Skill Modal */}
      <NewSkillModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={handleCreate}
      />

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
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (trimmed) onCreate(trimmed);
  };

  return (
    <Modal open={open} onClose={onClose} title="New Skill" maxWidth="max-w-sm">
      <div className="p-6 flex flex-col gap-4">
        <div>
          <FormLabel>Skill name</FormLabel>
          <FormInput
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="my-skill"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <span className="text-[10px] text-text-faint mt-1 block">
            Letters, numbers, hyphens, underscores only
          </span>
        </div>
      </div>
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel="Create"
        disabled={!name.trim()}
      />
    </Modal>
  );
}

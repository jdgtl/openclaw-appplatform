import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { PageShell } from "../components/PageShell.js";
import { StatusDot } from "../components/StatusDot.js";
import { AnimCounter } from "../components/AnimCounter.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { TextEditor } from "../components/TextEditor.js";
import {
  Modal,
  FormLabel,
  FormInput,
  ModalActions,
} from "../components/Modal.js";
import { usePolling } from "../lib/hooks.js";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "../lib/api.js";
import {
  Puzzle,
  Plus,
  Loader2,
  Zap,
  TrendingUp,
  Search,
  Save,
  Trash2,
  Crown,
  AlertTriangle,
} from "lucide-react";

// ── Types ──

interface UnifiedSkill {
  name: string;
  description: string;
  source: "custom" | "built-in" | "native";
  category: string;
  modified: string | null;
  usageCount: number;
  lastUsed: string | null;
}

interface SkillUsageSummary {
  bySkill: Record<string, { count: number; lastUsed: string | null }>;
  byDay: Record<string, Record<string, number>>;
  totalInvocations: number;
}

interface SkillsAllResponse {
  skills: UnifiedSkill[];
  usage: SkillUsageSummary;
}

// ── Constants ──

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "All", days: 365 },
];

const CATEGORY_STYLES: Record<string, { color: string; label: string }> = {
  Development:   { color: "#8b5cf6", label: "Dev" },
  Communication: { color: "#3b82f6", label: "Comm" },
  Data:          { color: "#06b6d4", label: "Data" },
  System:        { color: "#f59e0b", label: "System" },
  Custom:        { color: "#22c55e", label: "Custom" },
};

const CATEGORIES = ["All", "Development", "Communication", "Data", "System", "Custom"];

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Custom;
}

function getBentoSize(count: number, maxCount: number): "large" | "medium" | "small" {
  if (maxCount === 0) return "small";
  const ratio = count / maxCount;
  if (ratio >= 0.7) return "large";
  if (ratio >= 0.3) return "medium";
  return "small";
}

// ── Main Component ──

export function Skills() {
  const [days, setDays] = useState(30);
  const { data, loading } = usePolling<SkillsAllResponse>(`/skills/all?days=${days}`, 60_000);

  const skills = data?.skills ?? [];
  const usage = data?.usage ?? { bySkill: {}, byDay: {}, totalInvocations: 0 };

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<UnifiedSkill | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Derived data
  const activeSkills = useMemo(() =>
    skills
      .filter((s) => s.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 12),
    [skills],
  );

  const maxUsage = activeSkills[0]?.usageCount ?? 0;

  const filteredSkills = useMemo(() =>
    skills.filter((s) => {
      if (categoryFilter !== "All" && s.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    }),
    [skills, categoryFilter, searchQuery],
  );

  const totalActive = skills.filter((s) => s.usageCount > 0).length;
  const topSkill = activeSkills[0];

  // Handlers
  const refreshData = useCallback(() => {
    // Polling will refresh automatically
  }, []);

  const handleCreate = async (name: string) => {
    try {
      await postJSON("/skills", { name });
      setShowNew(false);
      refreshData();
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJSON(`/skills/${encodeURIComponent(deleteTarget)}`);
      setDeleteTarget(null);
      if (selectedSkill?.name === deleteTarget) setSelectedSkill(null);
    } catch { /* ignore */ }
  };

  if (loading && !data) {
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Puzzle size={20} className="text-accent" />
          <h2 className="text-base font-semibold text-text">Skills</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-input-bg border border-input-border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  days === r.days
                    ? "bg-accent text-white"
                    : "text-text-dim hover:text-text"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus size={14} />
            New Skill
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Skills" value={skills.length} sub="custom + built-in" accent="#06b6d4" icon={<Puzzle size={14} />} />
        <StatCard label="Active Skills" value={totalActive} sub="used in period" accent="#22c55e" icon={<Zap size={14} />} />
        <StatCard label="Invocations" value={usage.totalInvocations} sub={`${days}d window`} accent="#8b5cf6" icon={<TrendingUp size={14} />} />
        <StatCard
          label="Most Used"
          value={topSkill?.name ?? "—"}
          sub={topSkill ? `${topSkill.usageCount} invocations` : "no usage"}
          accent="#f59e0b"
          icon={<Crown size={14} />}
          isText
        />
      </div>

      {/* Active Skills Bento */}
      {activeSkills.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">
            Active Skills
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 auto-rows-[140px] gap-3">
            {activeSkills.map((skill, i) => (
              <SkillBentoCard
                key={skill.name}
                skill={skill}
                size={getBentoSize(skill.usageCount, maxUsage)}
                delay={i * 0.05}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card-bg border border-border rounded-xl p-8 text-center">
          <Zap size={24} className="text-text-faint mx-auto mb-2" />
          <p className="text-sm text-text-dim">No skill usage data in this period</p>
        </div>
      )}

      {/* All Skills */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            All Skills
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-input-bg border border-input-border p-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${
                    categoryFilter === cat
                      ? "bg-accent text-white"
                      : "text-text-dim hover:text-text"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-7 pr-3 py-1.5 text-xs bg-input-bg border border-input-border rounded-lg text-text focus:border-accent outline-none transition-colors w-40"
              />
            </div>
          </div>
        </div>

        {filteredSkills.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredSkills.map((skill, i) => (
              <SkillListCard
                key={skill.name}
                skill={skill}
                delay={i * 0.03}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-card-bg border border-border rounded-xl p-8 text-center">
            <Puzzle size={24} className="text-text-faint mx-auto mb-2" />
            <p className="text-sm text-text-dim">
              {skills.length === 0
                ? "No skills installed"
                : "No skills match your filters"}
            </p>
            {skills.length === 0 && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-3 text-sm text-accent hover:text-accent/80 transition-colors"
              >
                Create your first skill
              </button>
            )}
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onDelete={(name) => { setSelectedSkill(null); setDeleteTarget(name); }}
        />
      )}

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

// ── Sub-components ──

function StatCard({
  label, value, sub, accent, icon, isText,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  icon: React.ReactNode;
  isText?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-card-bg border border-border rounded-xl p-4 transition-all duration-200 hover:-translate-y-px"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ""; }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[10px] text-text-dim uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-xl font-bold text-text truncate">
        {isText ? value : typeof value === "number" ? <AnimCounter target={value} /> : value}
      </div>
      <div className="text-[11px] text-text-dim mt-0.5">{sub}</div>
    </motion.div>
  );
}

function SkillBentoCard({
  skill, size, delay, onClick,
}: {
  skill: UnifiedSkill;
  size: "large" | "medium" | "small";
  delay: number;
  onClick: () => void;
}) {
  const cat = getCategoryStyle(skill.category);
  const spanClass = size === "large"
    ? "col-span-2 row-span-2"
    : size === "medium"
      ? "col-span-2 row-span-1"
      : "col-span-1 row-span-1";

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      onClick={onClick}
      className={`${spanClass} bg-card-bg border border-border rounded-xl p-4 text-left transition-all duration-200 hover:-translate-y-px hover:border-opacity-60 relative overflow-hidden group`}
      style={{
        background: `radial-gradient(ellipse at top right, ${cat.color}0F, transparent 70%), var(--card-bg)`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}44`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ""; }}
    >
      {/* Category + source badges */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: cat.color, background: `${cat.color}18` }}
        >
          {cat.label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-text-faint uppercase">
            {skill.source === "custom" ? "Custom" : skill.source === "native" ? "Native" : "Built-in"}
          </span>
          <StatusDot status={skill.usageCount > 0 ? "active" : "idle"} size={5} />
        </div>
      </div>

      {/* Name */}
      <p className={`font-semibold text-text truncate ${size === "large" ? "text-base" : "text-sm"}`}>
        {skill.name}
      </p>

      {/* Description */}
      {size !== "small" && skill.description && (
        <p className={`text-text-dim mt-1 ${size === "large" ? "text-xs line-clamp-3" : "text-[11px] line-clamp-1"}`}>
          {skill.description}
        </p>
      )}

      {/* Usage count */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
        <Zap size={10} style={{ color: cat.color }} />
        <span className="text-lg font-bold tabular-nums" style={{ color: cat.color }}>
          <AnimCounter target={skill.usageCount} />
        </span>
      </div>
    </motion.button>
  );
}

function SkillListCard({
  skill, delay, onClick,
}: {
  skill: UnifiedSkill;
  delay: number;
  onClick: () => void;
}) {
  const cat = getCategoryStyle(skill.category);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      onClick={onClick}
      className="bg-card-bg border border-border rounded-xl p-3.5 text-left transition-all duration-200 hover:-translate-y-px relative overflow-hidden"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}33`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ""; }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: cat.color, background: `${cat.color}15` }}
        >
          {cat.label}
        </span>
        <StatusDot status={skill.usageCount > 0 ? "active" : "idle"} size={5} />
      </div>
      <p className="text-sm font-medium text-text truncate">{skill.name}</p>
      {skill.description && (
        <p className="text-[11px] text-text-dim mt-0.5 line-clamp-1">{skill.description}</p>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-[10px] text-text-faint">
          {skill.source === "custom" ? "Custom" : skill.source === "native" ? "Native" : "Built-in"}
        </span>
        {skill.usageCount > 0 && (
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: cat.color }}>
            {skill.usageCount} uses
          </span>
        )}
      </div>
    </motion.button>
  );
}

function SkillDetailModal({
  skill, onClose, onDelete,
}: {
  skill: UnifiedSkill;
  onClose: () => void;
  onDelete: (name: string) => void;
}) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(true);
  const [saving, setSaving] = useState(false);

  const isCustom = skill.source === "custom";
  const dirty = content !== originalContent;
  const cat = getCategoryStyle(skill.category);

  useEffect(() => {
    if (!isCustom) {
      setLoadingContent(false);
      return;
    }
    setLoadingContent(true);
    fetchJSON<{ content: string }>(`/skills/${encodeURIComponent(skill.name)}`)
      .then((data) => {
        setContent(data.content);
        setOriginalContent(data.content);
      })
      .catch(() => {
        setContent("Error loading skill");
      })
      .finally(() => setLoadingContent(false));
  }, [skill.name, isCustom]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await putJSON(`/skills/${encodeURIComponent(skill.name)}`, { content });
      onClose();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={skill.name} maxWidth="max-w-3xl">
      <div className="p-6 flex flex-col gap-4">
        {/* Skill info header */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ color: cat.color, background: `${cat.color}18` }}
          >
            {skill.category}
          </span>
          <span className="text-[10px] text-text-faint uppercase">
            {skill.source === "custom" ? "Custom Skill" : skill.source === "native" ? "Native Tool" : "Built-in"}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Zap size={10} style={{ color: cat.color }} />
            <span className="text-xs font-semibold" style={{ color: cat.color }}>
              {skill.usageCount} invocations
            </span>
          </div>
          {skill.lastUsed && (
            <span className="text-[10px] text-text-faint">
              Last used: {skill.lastUsed}
            </span>
          )}
        </div>

        {skill.description && (
          <p className="text-xs text-text-dim">{skill.description}</p>
        )}

        {/* Editor or read-only view */}
        {isCustom ? (
          loadingContent ? (
            <div className="flex items-center justify-center h-48 text-text-dim">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                  SKILL.md
                </span>
                {dirty && <span className="h-2 w-2 rounded-full bg-warning" />}
              </div>
              <TextEditor
                value={content}
                onChange={setContent}
                language="markdown"
                rows={18}
              />
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-xs">
                <AlertTriangle size={12} />
                Gateway restart required after changes
              </div>
            </>
          )
        ) : (
          <div className="bg-input-bg border border-input-border rounded-lg p-4 text-sm text-text-dim">
            Built-in skill — not editable via Mission Control
          </div>
        )}
      </div>

      {isCustom ? (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={() => onDelete(skill.name)}
            className="flex items-center gap-1.5 text-sm text-danger hover:text-danger/80 transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-text-dim hover:text-text transition-colors px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 text-sm text-white bg-accent px-4 py-1.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <ModalActions onCancel={onClose} onSubmit={onClose} submitLabel="Close" />
      )}
    </Modal>
  );
}

function NewSkillModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

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

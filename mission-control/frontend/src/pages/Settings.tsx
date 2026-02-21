import { useState, useEffect, useCallback } from "react";
import { PageShell } from "../components/PageShell.js";
import { TextEditor } from "../components/TextEditor.js";
import { usePolling } from "../lib/hooks.js";
import { fetchJSON, putJSON, postJSON } from "../lib/api.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Heart,
  Play,
  Server,
  Loader2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
} from "lucide-react";

interface SystemInfo {
  nodeVersion: string;
  uptime: number;
  mcVersion: string;
  pid: number;
  memory: { rss: number; heapUsed: number; heapTotal: number };
}

export function Settings() {
  const [configText, setConfigText] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: sysInfo } = usePolling<SystemInfo>("/system/info", 30_000);

  // Heartbeat config
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState("30");
  const [heartbeatSaving, setHeartbeatSaving] = useState(false);
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);

  // Gateway restart
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const config = await fetchJSON<Record<string, unknown>>("/config");
      setConfigText(JSON.stringify(config, null, 2));
      setConfigLoaded(true);
      setDirty(false);
      setError(null);

      const hb = config.heartbeat as Record<string, unknown> | undefined;
      if (hb) {
        setHeartbeatEnabled(hb.enabled !== false);
        setHeartbeatInterval(String(hb.intervalMinutes ?? hb.interval ?? "30"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const config = JSON.parse(configText);
      const result = await putJSON<{ ok: boolean; reloadError?: string }>("/config", { config });
      setDirty(false);
      if (result.reloadError) {
        setSuccess(`Config saved, but reload failed: ${result.reloadError}`);
      } else {
        setSuccess("Config saved & reloaded");
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHeartbeat = async () => {
    setHeartbeatSaving(true);
    setError(null);
    try {
      await putJSON("/config/heartbeat", {
        heartbeat: {
          enabled: heartbeatEnabled,
          intervalMinutes: parseInt(heartbeatInterval) || 30,
        },
      });
      setSuccess("Heartbeat config saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save heartbeat config");
    } finally {
      setHeartbeatSaving(false);
    }
  };

  const handleRunHeartbeat = async () => {
    setHeartbeatRunning(true);
    try {
      await postJSON("/system/heartbeat", {});
    } catch {
      // ignore
    } finally {
      setHeartbeatRunning(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    setRestartConfirm(false);
    setError(null);
    try {
      await postJSON("/system/restart", {});
      setSuccess("Gateway restart initiated — reconnecting...");
      setTimeout(() => setSuccess(null), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart gateway");
    } finally {
      setRestarting(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <PageShell title="Settings">
      {/* Feedback banners */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/15 text-danger text-sm">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success/15 text-success text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config Editor — takes 2 cols */}
        <div className="lg:col-span-2 bg-card-bg border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center">
                <SettingsIcon size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-text">Configuration</h3>
                <p className="text-xs text-text-dim">openclaw.json</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadConfig}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <RefreshCw size={12} />
                Reload
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 text-sm text-white bg-accent px-3 py-1.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Save & Reload
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-xs mb-3">
            <AlertTriangle size={12} />
            OpenClaw may strip managed sections (channels, commands) after loading
          </div>

          {configLoaded && (
            <TextEditor
              value={configText}
              onChange={(v) => { setConfigText(v); setDirty(true); }}
              language="json"
              rows={24}
            />
          )}
          {dirty && (
            <p className="text-xs text-warning mt-2">Unsaved changes</p>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Heartbeat */}
          <div className="bg-card-bg border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-danger/15 flex items-center justify-center">
                <Heart size={18} className="text-danger" />
              </div>
              <h3 className="text-sm font-medium text-text">Heartbeat</h3>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setHeartbeatEnabled(!heartbeatEnabled)}
                className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
              >
                {heartbeatEnabled ? (
                  <ToggleRight size={22} className="text-success" />
                ) : (
                  <ToggleLeft size={22} />
                )}
                <span className="text-sm">{heartbeatEnabled ? "Enabled" : "Disabled"}</span>
              </button>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-dim">Interval (minutes)</span>
                <input
                  type="number"
                  min={1}
                  value={heartbeatInterval}
                  onChange={(e) => setHeartbeatInterval(e.target.value)}
                  className="bg-input-bg text-sm text-text rounded-lg px-3 py-2 outline-none border border-input-border focus:border-accent transition-colors w-full"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveHeartbeat}
                  disabled={heartbeatSaving}
                  className="flex items-center gap-1.5 text-xs text-white bg-accent px-3 py-1.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {heartbeatSaving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save
                </button>
                <button
                  onClick={handleRunHeartbeat}
                  disabled={heartbeatRunning}
                  className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {heartbeatRunning ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  Run Now
                </button>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="bg-card-bg border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
                <Server size={18} className="text-success" />
              </div>
              <h3 className="text-sm font-medium text-text">System Info</h3>
            </div>
            {sysInfo ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-dim">Node</span>
                  <span className="text-text-muted font-mono text-xs">
                    {sysInfo.nodeVersion}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">MC Version</span>
                  <span className="text-text-muted">{sysInfo.mcVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Uptime</span>
                  <span className="text-text-muted">
                    {formatUptime(sysInfo.uptime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Memory (RSS)</span>
                  <span className="text-text-muted">
                    {formatBytes(sysInfo.memory.rss)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Heap</span>
                  <span className="text-text-muted">
                    {formatBytes(sysInfo.memory.heapUsed)} /{" "}
                    {formatBytes(sysInfo.memory.heapTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">PID</span>
                  <span className="text-text-muted font-mono text-xs">
                    {sysInfo.pid}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-faint">Loading...</p>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setRestartConfirm(true)}
                disabled={restarting}
                className="flex items-center gap-1.5 text-xs text-danger hover:text-white hover:bg-danger px-3 py-1.5 rounded-lg border border-danger/30 transition-all disabled:opacity-50"
              >
                {restarting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RotateCcw size={12} />
                )}
                Restart Gateway
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={restartConfirm}
        title="Restart Gateway"
        message="This will restart the OpenClaw gateway. Active sessions will be interrupted and the agent will be briefly unavailable."
        confirmLabel="Restart"
        danger
        onConfirm={handleRestart}
        onCancel={() => setRestartConfirm(false)}
      />
    </PageShell>
  );
}

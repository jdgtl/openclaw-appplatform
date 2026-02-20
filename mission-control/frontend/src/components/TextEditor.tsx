interface TextEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "json" | "markdown";
  rows?: number;
  readonly?: boolean;
}

export function TextEditor({
  value,
  onChange,
  language = "markdown",
  rows = 20,
  readonly = false,
}: TextEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={readonly}
      rows={rows}
      spellCheck={language === "markdown"}
      className={`w-full bg-surface-input text-sm text-text-primary rounded-lg px-4 py-3 outline-none border border-border-subtle focus:border-accent transition-colors resize-y font-mono leading-relaxed ${
        readonly ? "opacity-70 cursor-default" : ""
      }`}
    />
  );
}

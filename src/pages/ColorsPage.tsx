import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useColors, DEFAULT_COLORS, ColorSettings } from "../hooks/useColors";

interface ColorFieldDef {
  key: keyof ColorSettings;
  label: string;
}

const SECTIONS: { title: string; fields: ColorFieldDef[] }[] = [
  {
    title: "Foreground / Background",
    fields: [
      { key: "foreground", label: "Foreground" },
      { key: "background", label: "Background" },
      { key: "text1", label: "Text 1 (primary)" },
      { key: "text2", label: "Text 2 (secondary)" },
      { key: "buttonPrimary", label: "Action Button" },
    ],
  },
  {
    title: "Statuses",
    fields: [
      { key: "statusUnassigned", label: "Unassigned" },
      { key: "statusWaitHold", label: "Wait/Hold" },
      { key: "statusAssigned", label: "Assigned" },
      { key: "statusReview", label: "Review" },
      { key: "statusDone", label: "Done" },
    ],
  },
  {
    title: "Priorities",
    fields: [
      { key: "priorityCritical", label: "Critical" },
      { key: "priorityHigh", label: "High" },
      { key: "priorityMedium", label: "Medium" },
      { key: "priorityLow", label: "Low" },
    ],
  },
];

// Convert hex to 8-char ARGB string
function hexToArgb(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length === 6) return "FF" + clean.toUpperCase();
  if (clean.length === 8) return clean.toUpperCase();
  return "FF000000";
}

// Convert ARGB string to #hex (drop alpha for display, keep for storage)
function argbToHex(argb: string): string {
  const clean = argb.replace("#", "").toUpperCase();
  if (clean.length === 8) return "#" + clean.slice(2);
  if (clean.length === 6) return "#" + clean;
  return "#000000";
}

function isValidHex(val: string): boolean {
  return /^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(val);
}

export default function ColorsPage() {
  const navigate = useNavigate();
  const { colors, saveColors, loading } = useColors();
  const [draft, setDraft] = useState<ColorSettings>(colors);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(colors);
  }, [colors]);

  const setField = (key: keyof ColorSettings, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveColors(draft);
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all colors to defaults?")) return;
    setDraft(DEFAULT_COLORS);
    setSaving(true);
    try {
      await saveColors(DEFAULT_COLORS);
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="colors-page">
      <header className="form-header">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>
          ← Dashboard
        </button>
        <h1>Colors</h1>
      </header>

      <div className="colors-sections">
        {SECTIONS.map((section) => (
          <div key={section.title} className="colors-section">
            <h2 className="colors-section-title">{section.title}</h2>
            <div className="colors-grid">
              {section.fields.map((field) => (
                <div key={field.key} className="color-field">
                  <label className="color-label">{field.label}</label>
                  <div className="color-input-row">
                    <input
                      type="color"
                      className="color-picker"
                      value={draft[field.key]}
                      onChange={(e) => setField(field.key, e.target.value)}
                    />
                    <input
                      type="text"
                      className="color-hex-input"
                      value={draft[field.key].toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isValidHex(val)) {
                          setField(field.key, val.startsWith("#") ? val : "#" + val);
                        } else {
                          // Allow typing, validate on blur
                          setDraft((prev) => ({ ...prev, [field.key]: val }));
                        }
                      }}
                      onBlur={(e) => {
                        if (!isValidHex(e.target.value)) {
                          setDraft((prev) => ({ ...prev, [field.key]: colors[field.key] }));
                        }
                      }}
                      placeholder="#FF0000"
                    />
                    <input
                      type="text"
                      className="color-argb-input"
                      value={hexToArgb(draft[field.key])}
                      onChange={(e) => {
                        const val = e.target.value.replace("#", "");
                        if (/^[0-9A-Fa-f]{0,8}$/.test(val)) {
                          if (val.length === 8 || val.length === 6) {
                            setField(field.key, argbToHex(val));
                          }
                        }
                      }}
                      placeholder="FFRRGGBB"
                    />
                    <div
                      className="color-preview"
                      style={{ background: draft[field.key] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="colors-actions">
        <button className="btn btn-ghost" onClick={handleReset}>
          Reset to Defaults
        </button>
        <div className="colors-actions-right">
          {saved && <span className="colors-saved">Saved!</span>}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Colors"}
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="colors-preview-section">
        <h2 className="colors-section-title">Preview</h2>
        <div
          className="colors-preview-card"
          style={{ background: draft.background, padding: "20px", borderRadius: "8px" }}
        >
          <div
            style={{
              background: draft.foreground,
              padding: "14px 18px",
              borderRadius: "6px",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: draft.text1,
                fontSize: "0.85rem",
              }}
            >
              #1001
            </span>
            <span
              style={{
                background: draft.statusAssigned,
                color: "#0e0f11",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "0.72rem",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              assigned
            </span>
            <span style={{ color: draft.text1, fontWeight: 500, fontSize: "0.95rem" }}>
              Example ticket title
            </span>
            <span
              style={{
                marginLeft: "auto",
                color: draft.priorityHigh,
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
              }}
            >
              ◉ High
            </span>
          </div>
          <div
            style={{
              background: draft.foreground,
              padding: "14px 18px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: draft.text1,
                fontSize: "0.85rem",
              }}
            >
              #1002
            </span>
            <span
              style={{
                background: draft.statusReview,
                color: "#0e0f11",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "0.72rem",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              review
            </span>
            <span style={{ color: draft.text2, fontWeight: 500, fontSize: "0.95rem" }}>
              Another ticket (secondary text)
            </span>
            <span
              style={{
                marginLeft: "auto",
                color: draft.priorityCritical,
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
              }}
            >
              ⬤ Critical
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

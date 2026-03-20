import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";

export interface ColorSettings {
  // Foreground / Background
  foreground: string;
  background: string;
  text1: string;
  text2: string;
  // Statuses
  statusUnassigned: string;
  statusWaitHold: string;
  statusAssigned: string;
  statusReview: string;
  statusComplete: string;
  statusSent: string;
  // Priorities
  priorityCritical: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
}

export const DEFAULT_COLORS: ColorSettings = {
  foreground: "#16181c",
  background: "#0e0f11",
  text1: "#e8eaed",
  text2: "#8b8f98",
  statusUnassigned: "#6b7280",
  statusWaitHold: "#a855f7",
  statusAssigned: "#5b8def",
  statusReview: "#d4a853",
  statusComplete: "#4ecb71",
  statusSent: "#8b8f98",
  priorityCritical: "#ef4444",
  priorityHigh: "#f59e0b",
  priorityMedium: "#5b8def",
  priorityLow: "#8b8f98",
};

interface ColorCtx {
  colors: ColorSettings;
  setColors: (c: ColorSettings) => void;
  saveColors: (c: ColorSettings) => Promise<void>;
  loading: boolean;
}

const ColorContext = createContext<ColorCtx>({
  colors: DEFAULT_COLORS,
  setColors: () => {},
  saveColors: async () => {},
  loading: true,
});

function applyColors(c: ColorSettings) {
  const root = document.documentElement;
  root.style.setProperty("--bg-root", c.background);
  root.style.setProperty("--bg-card", c.foreground);
  root.style.setProperty("--bg-elevated", c.foreground);
  root.style.setProperty("--bg-input", c.foreground);

  // Compute a hover shade slightly lighter than foreground
  root.style.setProperty("--bg-hover", lighten(c.foreground, 0.08));

  root.style.setProperty("--text-primary", c.text1);
  root.style.setProperty("--text-secondary", c.text2);
  root.style.setProperty("--text-muted", c.text2);

  root.style.setProperty("--status-unassigned", c.statusUnassigned);
  root.style.setProperty("--status-wait-hold", c.statusWaitHold);
  root.style.setProperty("--status-assigned", c.statusAssigned);
  root.style.setProperty("--status-review", c.statusReview);
  root.style.setProperty("--status-complete", c.statusComplete);
  root.style.setProperty("--status-sent", c.statusSent);

  root.style.setProperty("--priority-critical", c.priorityCritical);
  root.style.setProperty("--priority-high", c.priorityHigh);
  root.style.setProperty("--priority-medium", c.priorityMedium);
  root.style.setProperty("--priority-low", c.priorityLow);

  // Highlight outlines for my-assigned / my-review
  root.style.setProperty("--highlight-assigned", c.statusAssigned);
  root.style.setProperty("--highlight-review", c.statusReview);
}

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * amount));
  const ng = Math.min(255, Math.round(g + (255 - g) * amount));
  const nb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export function ColorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [colors, setColors] = useState<ColorSettings>(DEFAULT_COLORS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .getColors()
      .then((data) => {
        if (data?.settings && Object.keys(data.settings).length > 0) {
          const merged = { ...DEFAULT_COLORS, ...data.settings };
          setColors(merged);
          applyColors(merged);
        } else {
          applyColors(DEFAULT_COLORS);
        }
      })
      .catch(() => {
        applyColors(DEFAULT_COLORS);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const saveColors = useCallback(async (c: ColorSettings) => {
    setColors(c);
    applyColors(c);
    await api.updateColors(c);
  }, []);

  return (
    <ColorContext.Provider value={{ colors, setColors, saveColors, loading }}>
      {children}
    </ColorContext.Provider>
  );
}

export const useColors = () => useContext(ColorContext);

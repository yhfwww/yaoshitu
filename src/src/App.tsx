import { useEffect, useState, type ComponentType } from "react";
import { useStore } from "./store/useStore";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { TaskEditor } from "./components/TaskEditor";
import { SettingsDialog } from "./components/SettingsDialog";
import { CoordinateView } from "./views/CoordinateView";
import { MatrixView } from "./views/MatrixView";
import { ListView } from "./views/ListView";
import { SmartViews } from "./views/SmartViews";
import { DashboardView } from "./views/DashboardView";
import { PrinciplesView } from "./views/PrinciplesView";
import { ArchiveView } from "./views/ArchiveView";
import type { ViewId } from "./db/schema";

const VIEW_COMPONENTS: Record<ViewId, ComponentType> = {
  coordinate: CoordinateView,
  matrix: MatrixView,
  list: ListView,
  smart: SmartViews,
  dashboard: DashboardView,
  principles: PrinciplesView,
  archive: ArchiveView,
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const view = useStore((s) => s.view);
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const openEditor = useStore((s) => s.openEditor);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useStore.getState().commandOpen);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openEditor();
      } else if (e.key === "/") {
        e.preventDefault();
        setCommandOpen(true);
      } else if (e.key === "Escape") {
        useStore.getState().selectTask(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen, openEditor]);

  if (!ready) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--c-text-muted)",
        }}
      >
        加载中…
      </div>
    );
  }

  const ViewComponent = VIEW_COMPONENTS[view] ?? CoordinateView;

  return (
    <div style={{ height: "100%", display: "flex" }}>
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <ViewComponent />
      </main>
      <CommandPalette />
      <TaskEditor />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

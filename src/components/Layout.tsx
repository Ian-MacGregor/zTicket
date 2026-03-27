import Topbar from "./Topbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Topbar />
      {children}
    </div>
  );
}

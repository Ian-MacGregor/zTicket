export default function PanelDrawer({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-drawer" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

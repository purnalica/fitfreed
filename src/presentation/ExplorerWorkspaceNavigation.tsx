interface ExplorerWorkspaceOption<Workspace extends string> {
  workspace: Workspace;
  label: string;
  disabled?: boolean;
}

interface ExplorerWorkspaceNavigationProps<Workspace extends string> {
  label: string;
  current: Workspace;
  options: ExplorerWorkspaceOption<Workspace>[];
  onSelect: (workspace: Workspace) => void;
}

export function ExplorerWorkspaceNavigation<Workspace extends string>({
  label,
  current,
  options,
  onSelect,
}: ExplorerWorkspaceNavigationProps<Workspace>) {
  return (
    <nav className="explorer-workspace-navigation" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.workspace}
          type="button"
          aria-current={current === option.workspace ? "page" : undefined}
          disabled={option.disabled}
          onClick={() => onSelect(option.workspace)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}

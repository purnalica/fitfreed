interface WorkspaceOption<Workspace extends string> {
  workspace: Workspace;
  label: string;
  disabled?: boolean;
}

interface WorkspaceNavigationProps<Workspace extends string> {
  label: string;
  current: Workspace;
  options: WorkspaceOption<Workspace>[];
  onSelect: (workspace: Workspace) => void;
}

export function WorkspaceNavigation<Workspace extends string>({
  label,
  current,
  options,
  onSelect,
}: WorkspaceNavigationProps<Workspace>) {
  return (
    <nav className="workspace-navigation" aria-label={label}>
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

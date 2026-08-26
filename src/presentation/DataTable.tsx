import type {
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

interface DataTableProps {
  accessibleName: string;
  children: ReactNode;
  className?: string;
}

function classNames(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

export function DataTable({ accessibleName, children, className }: DataTableProps) {
  return (
    <div
      className="data-table-scroll"
      role="region"
      aria-label={accessibleName}
      tabIndex={0}
    >
      <table className={classNames("data-table", className)}>
        <caption className="sr-only">{accessibleName}</caption>
        {children}
      </table>
    </div>
  );
}

export function NumericTableHeader({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={classNames("data-table-number", className)} />;
}

export function NumericTableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={classNames("data-table-number", className)} />;
}

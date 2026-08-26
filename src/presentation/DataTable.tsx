import type {
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

interface DataTableProps {
  accessibleName: string;
  children: ReactNode;
  className?: string;
  scrollAccessibleName?: string;
  scrollClassName?: string;
}

function classNames(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

export function DataTable({
  accessibleName,
  children,
  className,
  scrollAccessibleName = accessibleName,
  scrollClassName,
}: DataTableProps) {
  return (
    <div
      className={classNames("data-table-scroll", scrollClassName)}
      role="region"
      aria-label={scrollAccessibleName}
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

import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Visually hidden caption for assistive technology. */
  caption: string;
  wrapperClassName?: string;
}

export function Table({
  caption,
  className,
  wrapperClassName,
  children,
  ...props
}: TableProps) {
  return (
    <div className={cn("w-full scrollbar-thin overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full border-collapse text-sm", className)} {...props}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TFoot({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("bg-surface-subtle font-medium", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-border transition-colors last:border-b-0", className)}
      {...props}
    />
  );
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

/** Sentence-case, quiet column headers; the data carries the weight. */
export function Th({ numeric, className, scope = "col", ...props }: ThProps) {
  return (
    <th
      scope={scope}
      className={cn(
        "h-10 border-b border-border px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-ink-muted first:pl-4 last:pr-4",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function Td({ numeric, className, ...props }: TdProps) {
  return (
    <td
      className={cn(
        "h-11 px-3 align-middle whitespace-nowrap first:pl-4 last:pr-4",
        numeric && "text-right tabular",
        className,
      )}
      {...props}
    />
  );
}

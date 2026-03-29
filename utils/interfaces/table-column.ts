import { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

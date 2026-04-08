export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelect {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  placeholder?: string;
  /** Width / other classes applied to the SelectTrigger, e.g. "w-full sm:w-44" */
  className?: string;
}

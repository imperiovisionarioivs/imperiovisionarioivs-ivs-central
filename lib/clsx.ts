type ClassValue = string | number | boolean | null | undefined;

export function clsx(...args: ClassValue[]): string {
  return args.filter(Boolean).join(" ");
}

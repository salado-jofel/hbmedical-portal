// app/(components)/SubmitButton.tsx
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CSSProperties, ReactNode } from "react";

export default function SubmitButton({
  isPending,
  type,
  isPendingMesssage,
  cta,
  variant,
  size,
  classname,
  asChild,
  onClick,
  form,
  style,
  disabled, // ✅ added
}: {
  isPending?: boolean;
  type: "button" | "submit" | "reset" | undefined;
  isPendingMesssage?: string | undefined;
  cta: ReactNode;
  variant:
    | "link"
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | null
    | undefined;
  size:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg"
    | null
    | undefined;
  classname?: string;
  asChild?: boolean;
  onClick?: () => void;
  form?: string;
  style?: CSSProperties;
  disabled?: boolean; // ✅ added
}) {
  return (
    <Button
      asChild={asChild}
      type={type}
      disabled={isPending || disabled} // ✅ either pending OR explicitly disabled
      variant={variant}
      size={size}
      className={`${classname} duration-200 cursor-pointer`}
      onClick={onClick}
      form={form}
      style={style}
    >
      {isPending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" /> {isPendingMesssage}
        </>
      ) : (
        <>{cta}</>
      )}
    </Button>
  );
}

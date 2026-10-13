import * as React from "react";
import { formatPaise } from "@/shared/lib/money";
import { cn } from "@/shared/lib/utils";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  paise: number;
  includeDecimals?: boolean;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  paise,
  includeDecimals = false,
  className,
  ...props
}) => {
  const formatted = formatPaise(paise, includeDecimals);

  return (
    <span
      className={cn("font-medium tracking-tight tabular-nums", className)}
      aria-label={`${formatted} Indian Rupees`}
      {...props}
    >
      {formatted}
    </span>
  );
};

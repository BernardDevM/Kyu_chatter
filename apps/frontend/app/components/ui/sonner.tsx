import { Toaster as Sonner, ToasterProps } from "sonner";

import { useTheme } from "@/providers/theme-provider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { appTheme: theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !font-sans !shadow-lg",
          title: "!font-semibold",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

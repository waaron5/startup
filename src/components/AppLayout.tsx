import type { ReactNode } from "react";
import SiteFooter from "./SiteFooter";

type AppLayoutProps = {
  header?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
};

export default function AppLayout({
  header,
  children,
  mainClassName = "flex-1",
}: AppLayoutProps) {
  return (
    <div className="bg-bg text-text min-h-screen flex flex-col">
      {header}
      <main className={mainClassName}>{children}</main>
      <SiteFooter />
    </div>
  );
}

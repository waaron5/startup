import SiteFooter from "./SiteFooter";

export default function AppLayout({
  header,
  children,
  mainClassName = "flex-1",
}) {
  return (
    <div className="bg-bg text-text min-h-screen flex flex-col">
      {header}
      <main className={mainClassName}>{children}</main>
      <SiteFooter />
    </div>
  );
}

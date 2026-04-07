import TopNav from "./TopNav";

type SiteHeaderProps = {
  subtitle?: boolean;
};

export default function SiteHeader({ subtitle }: SiteHeaderProps) {
  return (
    <header className={`w-full pt-3 ${subtitle ? "pb-6" : "pb-4"}`}>
      <TopNav />
      {subtitle ? (
        <p className="mx-auto mt-6 max-w-2xl text-center text-text-muted">
          <em>
            Collaborate to pull off daring heists against a corrupt regime, but remember:
            <br />
            one player is not who they claim to be.
          </em>
        </p>
      ) : null}
    </header>
  );
}

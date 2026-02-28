import TopNav from "./TopNav";

type SiteHeaderProps = {
  subtitle?: boolean;
};

export default function SiteHeader({ subtitle }: SiteHeaderProps) {
  return (
    <header className="flex flex-col justify-center items-center mt-12 mb-8">
      <TopNav />
      <h1 className="font-metal text-6xl text-text text-center leading-none">
        <span className="block sm:inline">The Quisling</span>
      </h1>
      {subtitle ? (
        <p className="text-center text-text-muted mt-8">
          <em>Collaborate to pull off daring heists against a corrupt regime, but
          remember:
          <br />
          one player is not who they claim to be.</em>
        </p>
      ) : null}
    </header>
  );
}

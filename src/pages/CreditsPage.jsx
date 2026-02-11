import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";

export default function CreditsPage() {
  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex items-center justify-center p-6"
    >
      <section className="card w-full max-w-2xl text-center">
        <h2 className="text-2xl">Credits</h2>
        <p className="text-text-muted mt-3">
          <a
            className="hover:text-text"
            href="https://www.flaticon.com/free-icons/rpg"
            title="rpg icons"
          >
            Rpg icons created by max.icons - Flaticon
          </a>
        </p>
      </section>
    </AppLayout>
  );
}

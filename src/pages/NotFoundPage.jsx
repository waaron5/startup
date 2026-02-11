import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";

export default function NotFoundPage() {
  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex items-center justify-center p-6"
    >
      <section className="card w-full max-w-2xl text-center">
        <h2 className="text-2xl">Page not found</h2>
        <p className="text-text-muted mt-3">
          <Link className="hover:text-text" to="/">
            Return to home
          </Link>
        </p>
      </section>
    </AppLayout>
  );
}

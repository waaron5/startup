import AppLayout from "../components/AppLayout";
import PlaceholderCard from "../components/PlaceholderCard";
import SiteHeader from "../components/SiteHeader";

export default function ResultsPage() {
  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex items-center justify-center p-6"
    >
      <PlaceholderCard
        title="Results Page"
        message="Route is active. Static results markup migration is next."
      />
    </AppLayout>
  );
}

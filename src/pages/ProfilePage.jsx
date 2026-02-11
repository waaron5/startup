import AppLayout from "../components/AppLayout";
import PlaceholderCard from "../components/PlaceholderCard";
import SiteHeader from "../components/SiteHeader";

export default function ProfilePage() {
  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex items-center justify-center p-6"
    >
      <PlaceholderCard
        title="Profile Page"
        message="Route is active. Static profile markup migration is next."
      />
    </AppLayout>
  );
}

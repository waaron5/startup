import AppLayout from "../components/AppLayout";
import PlaceholderCard from "../components/PlaceholderCard";
import SiteHeader from "../components/SiteHeader";

export default function GamePage() {
  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex items-center justify-center p-6"
    >
      <PlaceholderCard
        title="Game Page"
        message="Route is active. Static game markup migration is the next step."
      />
    </AppLayout>
  );
}

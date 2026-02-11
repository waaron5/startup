export default function PlaceholderCard({ title, message }) {
  return (
    <section className="card w-full max-w-2xl text-center">
      <h2 className="text-2xl">{title}</h2>
      <p className="text-text-muted mt-3">{message}</p>
    </section>
  );
}

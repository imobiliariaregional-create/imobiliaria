import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}

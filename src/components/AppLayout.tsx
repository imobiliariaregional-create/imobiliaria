import { Outlet } from "react-router-dom";
import { Nav } from "@/components/Nav";

export function AppLayout() {
  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}

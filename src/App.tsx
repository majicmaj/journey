import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "./components/ui/button";
import { Home, Sliders } from "./components/pixel/icons";

const isActive = (path: string, currentPath: string) =>
  (currentPath.startsWith(path) && path !== "/") || currentPath === path;

const NavButton = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => {
  const { pathname } = useLocation();
  return (
    <Button asChild variant={isActive(to, pathname) ? "default" : "outline"}>
      <Link to={to}>{children}</Link>
    </Button>
  );
};

function App() {
  return (
    <div className="font-display min-h-svh p-3 flex flex-col gap-3">
      {/* Desktop top nav */}
      <nav className="hidden md:flex pixel-frame bg-card text-card-foreground p-3 gap-3 justify-center">
        <NavButton to="/">Today</NavButton>
        <NavButton to="/settings">Settings</NavButton>
      </nav>

      <main className="flex-1 p-1overflow-y-auto">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}

export default App;

function MobileBottomNav() {
  const { pathname } = useLocation();
  const Item = ({
    to,
    Icon,
    label,
  }: {
    to: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
  }) => (
    <Button
      asChild
      variant={isActive(to, pathname) ? "default" : "outline"}
      size="icon-lg"
      aria-label={label}
    >
      <Link to={to}>
        <Icon className="size-8" fill="currentColor" />
      </Link>
    </Button>
  );

  return (
    <nav
      className="md:hidden pixel-frame bg-card text-card-foreground p-2 fixed bottom-0 left-0 right-0 z-50"
      // style={{ paddingBottom: "calc(env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-md grid grid-cols-2 gap-2 justify-items-center">
        <Item to="/" Icon={Home} label="Today" />
        <Item to="/settings" Icon={Sliders} label="Settings" />
      </div>
    </nav>
  );
}

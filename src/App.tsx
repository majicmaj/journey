import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "./components/ui/button";
import { Home, Calendar, Sliders } from "./components/pixel/icons";

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
    <div className="font-display max-h-svh overflow-y-auto min-h-svh flex flex-col gap-3">
      {/* Desktop top nav */}
      <nav className="hidden md:flex pixel-frame bg-card text-card-foreground p-3 gap-3 justify-center">
        <NavButton to="/">Day</NavButton>
        <NavButton to="/trends">Trends</NavButton>
        <NavButton to="/settings">Settings</NavButton>
      </nav>

      <main className="flex-1 p-1overflow-y-auto pb-20 sm:pb-0">
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
      variant={isActive(to, pathname) ? "default" : "background"}
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
      className="md:hidden grid px-2 fixed inset-x-0 bottom-0 z-50 bg-card text-card-foreground pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      role="navigation"
      aria-label="Mobile"
    >
      <div className="pixel-frame p-2">
        <div className="mx-auto max-w-md grid grid-cols-3 gap-2 justify-items-center">
          <Item to="/" Icon={Home} label="Day" />
          <Item to="/trends" Icon={Calendar} label="Trends" />
          <Item to="/settings" Icon={Sliders} label="Settings" />
        </div>
      </div>
    </nav>
  );
}

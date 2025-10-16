import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "./components/ui/button";

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
    <div className="font-display min-h-svh flex flex-col">
      <nav className="pixel-frame bg-card text-card-foreground p-3 flex gap-3 justify-center">
        <NavButton to="/">Today</NavButton>
        <NavButton to="/history">History</NavButton>
        <NavButton to="/trends">Trends</NavButton>
        <NavButton to="/settings">Settings</NavButton>
      </nav>
      <main className="flex-1 p-3">
        <Outlet />
      </main>
    </div>
  );
}

export default App;

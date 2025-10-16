import { Outlet, Link } from "react-router-dom";

function App() {
  return (
    <div className="font-display min-h-svh flex flex-col">
      <nav className="pixel-frame bg-card text-card-foreground p-2 flex gap-3 justify-center">
        <Link to="/">Today</Link>
        <Link to="/history">History</Link>
        <Link to="/trends">Trends</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <main className="flex-1 p-3">
        <Outlet />
      </main>
    </div>
  );
}

export default App;

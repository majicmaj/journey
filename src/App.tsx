import { Button } from "@/components/ui/button";

function App() {
  return (
    <div className="font-display gap-4 flex min-h-svh flex-col items-center justify-center">
      <textarea className="bg-card p-2" rows={10} cols={40} />
      <Button className="pixel-frame">Click me</Button>
    </div>
  );
}

export default App;

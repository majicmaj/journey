import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, WarningIcon } from "@/components/pixel/icons";

export default function ErrorPage() {
  const error = useRouteError();

  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Something went wrong";

  const description = isRouteErrorResponse(error)
    ? error.data?.message || error.data || ""
    : (error as Error)?.message || "An unexpected error occurred.";

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <div className="pixel-frame bg-card text-card-foreground max-w-xl w-full">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <WarningIcon className="size-16 text-destructive" />
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-muted-foreground whitespace-pre-wrap break-words">
              {String(description)}
            </p>
          ) : null}
          <div className="flex gap-3 pt-2">
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 size-5" /> Go Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Day from "@/features/today/Today";
import Settings from "@/features/settings/Settings";
import Trends from "@/features/trends/Trends";
import { useSettings } from "@/hooks/useData";
import { applyTheme } from "@/lib/theme";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import ErrorPage from "@/features/error/ErrorPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Day /> },
      { path: "trends", element: <Trends /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <ErrorPage /> },
    ],
  },
]);

const queryClient = new QueryClient();

export function ThemeInitializer() {
  const { data } = useSettings();
  useEffect(() => {
    if (data) applyTheme(data);
  }, [data]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <Toaster richColors position="top-center" />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);

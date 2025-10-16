import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Today from "@/features/today/Today";
import History from "@/features/history/History";
import Trends from "@/features/trends/Trends";
import Settings from "@/features/settings/Settings";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Today /> },
      { path: "history", element: <History /> },
      { path: "trends", element: <Trends /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);

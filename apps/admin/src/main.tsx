import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ThemeScope, Toaster, TooltipProvider } from '@vantara-ui/ui';
import './index.css';
import { router } from './router';
import { ittiPalette } from './theme/palette';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ITTI palette on :root, light mode only (see src/theme/palette.ts) */}
    <ThemeScope palette={ittiPalette} colorMode="light" global>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeScope>
  </StrictMode>,
);

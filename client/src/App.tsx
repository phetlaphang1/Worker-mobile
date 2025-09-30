import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from './libs/queryClient';
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import NotFoundPage from './pages/not-found';
import { RequireAuth } from '@/components/modals/requireAuth';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route 
                  path="/*" 
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  } 
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

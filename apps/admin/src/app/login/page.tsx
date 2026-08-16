'use client';

import { LoginForm } from '../../components/login-form';
import { ThemeToggle } from '../../components/ui/theme-toggle';

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-8">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <LoginForm />
    </main>
  );
}

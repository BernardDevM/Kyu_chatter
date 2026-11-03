import { LoginForm } from "@/features/auth/components/login-form";

export const meta = () => [{ title: "Sign in · SWE Distributed Systems" }];

export default function LoginRoute() {
  return <LoginForm />;
}

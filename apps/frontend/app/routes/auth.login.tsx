import { LoginForm } from "@/features/auth/components/login-form";

export const meta = () => [{ title: "Sign in · Kyu Chatter" }];

export default function LoginRoute() {
  return <LoginForm />;
}

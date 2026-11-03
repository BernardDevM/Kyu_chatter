import { SignupForm } from "@/features/auth/components/signup-form";

export const meta = () => [{ title: "Sign up · SWE Distributed Systems" }];

export default function SignupRoute() {
  return <SignupForm />;
}

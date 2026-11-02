import { SignupForm } from "@/features/auth/components/signup-form";

export const meta = () => [{ title: "Sign up · Kyu Chatter" }];

export default function SignupRoute() {
  return <SignupForm />;
}

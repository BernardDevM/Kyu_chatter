import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useAuthService } from "../api/use-auth-service";
import { signInSchema,type SignInValues } from "../schemas/auth-schema";
import { AuthContainer } from "./auth-container";
import { DevLogin } from "./dev-login";
import { GoogleAuth } from "./google-auth";

export function LoginForm() {
  const { signIn } = useAuthService();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <AuthContainer
      title="Welcome back"
      subtitle="Sign in to continue chatting"
      footer={
        <>
          New here?{" "}
          <Link to="/auth/signup" className="text-primary font-medium">
            Create an account
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => signIn.mutate(v))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={signIn.isPending}>
            {signIn.isPending && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </Form>
      <GoogleAuth />
      <DevLogin />
    </AuthContainer>
  );
}

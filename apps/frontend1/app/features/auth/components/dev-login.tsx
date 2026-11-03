import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useAuthService } from "../api/use-auth-service";
import { devSignInSchema,type DevSignInValues } from "../schemas/auth-schema";

/** Dev only: act as any user id via the x-dev-user-id header (no password). */
export function DevLogin() {
  const { devSignIn } = useAuthService();
  const form = useForm<DevSignInValues>({
    resolver: zodResolver(devSignInSchema),
    defaultValues: { userId: "" },
  });

  if (!import.meta.env.DEV) return null;

  return (
    <details className="group mt-8 border-t pt-4">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer font-mono text-xs select-none">
        dev login
      </summary>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => devSignIn(v.userId))}
          className="mt-3 space-y-2"
        >
          <p className="text-muted-foreground text-xs">
            Backend needs ALLOW_DEV_USER_HEADER=true
          </p>
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="user id, e.g. usr_123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="secondary">
              Go
            </Button>
          </div>
        </form>
      </Form>
    </details>
  );
}

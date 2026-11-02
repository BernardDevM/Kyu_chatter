import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

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
import { Textarea } from "@/components/ui/textarea";
import type { UserSummary } from "@/features/users/types/user";

import { useCreateGroup } from "../api/use-room-service";
import { createGroupSchema,type CreateGroupValues } from "../schemas/room-schema";
import { useNewChatStore } from "../stores/new-chat-store";
import { UserPicker } from "./user-picker";

export function CreateGroupForm() {
  const navigate = useNavigate();
  const onClose = useNewChatStore((s) => s.onClose);
  const createGroup = useCreateGroup();
  const [members, setMembers] = useState<UserSummary[]>([]);
  const form = useForm<CreateGroupValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", description: "" },
  });

  const toggle = (u: UserSummary) =>
    setMembers((m) =>
      m.some((x) => x.id === u.id) ? m.filter((x) => x.id !== u.id) : [...m, u],
    );

  const onSubmit = (v: CreateGroupValues) =>
    createGroup.mutate(
      {
        name: v.name,
        ...(v.description ? { description: v.description } : {}),
        memberUserIds: members.map((m) => m.id),
      },
      {
        onSuccess: (room) => {
          onClose();
          navigate(`/chat/${room.id}`);
        },
      },
    );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Group name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Members</p>
          <UserPicker selected={members} onToggle={toggle} />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={createGroup.isPending || members.length === 0}
        >
          {createGroup.isPending && <Loader2 className="animate-spin" />}
          Create group
        </Button>
      </form>
    </Form>
  );
}

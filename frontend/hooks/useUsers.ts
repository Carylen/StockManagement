import useSWR from "swr";
import { api } from "@/lib/api";
import type { AppUser } from "@/lib/types";

export function useUsers() {
  return useSWR<AppUser[]>("/users", (u: string) => api.get<AppUser[]>(u));
}

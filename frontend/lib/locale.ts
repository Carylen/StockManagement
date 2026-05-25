"use server";

import { cookies } from "next/headers";

export async function setLocaleCookie(locale: "en" | "id") {
  (await cookies()).set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

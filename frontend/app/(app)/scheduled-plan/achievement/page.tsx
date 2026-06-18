import { redirect } from "next/navigation";

// Overview + Achievement were merged into a single page with a status filter
// (All / Ready / Not Ready). This route now redirects to the unified overview.
export default function PlanAchievementRedirect() {
  redirect("/scheduled-plan/overview");
}

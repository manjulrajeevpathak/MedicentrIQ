import { Lock } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { AdminView } from "@/components/admin/admin-view";
import { fetchBranches, fetchUsers } from "@/lib/users-api";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const usersResult = await fetchUsers();

  if (!usersResult.ok) {
    if (usersResult.status === 403) {
      return (
        <Panel>
          <EmptyState
            icon={<Lock className="size-5" />}
            title="You need administrator access"
            description="User management is limited to organisation administrators. Ask an org admin to grant you access."
          />
        </Panel>
      );
    }
    return (
      <Panel>
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Couldn't load user management"
          description={usersResult.error ?? "The server is unavailable. Try again in a moment."}
        />
      </Panel>
    );
  }

  const branches = await fetchBranches();

  return (
    <AdminView
      users={usersResult.data.users}
      seats={usersResult.data.seats}
      mfaPolicy={usersResult.data.mfaPolicy}
      branches={branches}
    />
  );
}

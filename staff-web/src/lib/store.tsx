"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AccessState, AuditEvent, DashboardData, DirectoryPatient, PatientChannel, PatientSummary, PermissionKey, QueuePriority } from "./types";

/** Fields collected by the Add-patient form. */
export type NewPatientInput = {
  name: string;
  age: number;
  gender: string;
  phone: string;
  condition: string;
  doctor: string;
  language: string;
  risk: QueuePriority;
  source?: PatientChannel;
};

/* ---------------------------------------------------------------------------
   App store — a client-side source of truth seeded from the server fetch and
   held in the (app) layout so it persists across route navigation. Staff
   actions mutate it optimistically, which closes the action loop (a resolved
   task actually leaves the queue) and keeps sidebar badges / audit feed live.
   ------------------------------------------------------------------------- */

type AppContextValue = {
  data: DashboardData;
  branch: { id: string; name: string };
  badges: { workbench: number; inbox: number; access: number; continuity: number; ai: number };
  patientIdByName: (name: string) => string | undefined;

  /** Adds a patient to the directory + Patient 360 and returns the new id. */
  addPatient: (input: NewPatientInput) => string;
  /** Bulk-adds patients from a CSV import and returns the count added. */
  addPatientsBulk: (rows: Array<{ name: string; phone: string; source?: PatientChannel }>) => number;
  resolveTask: (id: string) => void;
  assignConversation: (id: string, owner?: string) => void;
  escalateConversation: (id: string) => void;
  linkConversation: (id: string, patient?: string) => void;
  holdSlot: (reqId: string) => void;
  confirmAppointment: (reqId: string) => void;
  sendMobileLink: (reqId: string) => void;
  completeFollowUp: (id: string) => void;
  escalateFollowUp: (id: string) => void;
  acceptRecommendation: (id: string) => void;
  dismissRecommendation: (id: string, reason?: string) => void;
  setBranch: (id: string, name: string) => void;
  togglePermission: (userId: string, key: PermissionKey) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

let auditSeq = 5000;

export function AppProvider({ initial, children }: { initial: DashboardData; children: ReactNode }) {
  const [data, setData] = useState<DashboardData>(initial);
  const [branch, setBranchState] = useState(initial.authContext.branch);

  const audit = useCallback(
    (action: string, resource: string, summary: string): AuditEvent => {
      auditSeq += 1;
      return {
        id: `AUD-${auditSeq}`,
        at: new Date().toISOString(),
        actor: data.authContext.activeUser.name,
        actorRole: data.authContext.activeUser.role,
        action,
        resource,
        tenantId: data.authContext.tenant.id,
        branchId: branch.id,
        outcome: "allowed",
        summary
      };
    },
    [data.authContext, branch.id]
  );

  const addPatient = useCallback(
    (input: NewPatientInput): string => {
      const id = `pt-${Date.now().toString(36)}`;
      const uhid = `UH-${Math.floor(100000 + Math.random() * 899999)}`;
      const tags = input.condition ? [input.condition] : [];
      const directoryPatient: DirectoryPatient = {
        id,
        name: input.name,
        age: input.age,
        gender: input.gender,
        phone: input.phone,
        uhid,
        branch: branch.name,
        doctor: input.doctor || "Unassigned",
        condition: input.condition || "Intake pending",
        risk: input.risk,
        lastSeen: "Just now",
        tags,
        source: input.source
      };
      const profile: PatientSummary = {
        id,
        name: input.name,
        age: input.age,
        gender: input.gender,
        phone: input.phone,
        caregiver: "—",
        language: input.language,
        branch: branch.name,
        doctor: input.doctor || "Unassigned",
        condition: input.condition || "Intake pending",
        risk: input.risk,
        nextBestAction: "Complete intake and confirm the first appointment.",
        openItems: ["New patient — intake pending"],
        timeline: [
          { at: "Just now", title: "Patient created", note: `${input.name} added to the directory from the staff console.`, kind: "system" }
        ]
      };
      setData((d) => ({
        ...d,
        directory: [directoryPatient, ...d.directory],
        patientProfiles: { ...d.patientProfiles, [id]: profile },
        auditEvents: [audit("patient.create", id, `Created patient ${input.name} (${uhid}).`), ...d.auditEvents]
      }));
      return id;
    },
    [audit, branch.name]
  );

  const addPatientsBulk = useCallback(
    (rows: Array<{ name: string; phone: string; source?: PatientChannel }>): number => {
      const newPatients: DirectoryPatient[] = rows.map((row) => ({
        id: `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: row.name,
        age: 0,
        gender: "unknown",
        phone: row.phone,
        uhid: `UH-${Math.floor(100000 + Math.random() * 899999)}`,
        branch: branch.name,
        doctor: "Unassigned",
        condition: "Intake pending",
        risk: "low" as QueuePriority,
        lastSeen: "Just now",
        tags: row.source ? [row.source] : [],
        source: row.source
      }));
      setData((d) => ({
        ...d,
        directory: [...newPatients, ...d.directory],
        auditEvents: [
          audit("patient.create", "bulk", `Bulk imported ${newPatients.length} patients via CSV.`),
          ...d.auditEvents
        ]
      }));
      return newPatients.length;
    },
    [audit, branch.name]
  );

  const resolveTask = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        workbench: d.workbench.filter((w) => w.id !== id),
        auditEvents: [audit("workbench.complete", id, `Resolved work item ${id}.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const assignConversation = useCallback(
    (id: string, owner = "care_coordinator") => {
      setData((d) => ({
        ...d,
        inbox: d.inbox.map((c) => (c.id === id ? { ...c, status: "assigned", assignee: owner } : c)),
        auditEvents: [audit("inbox.assign", id, `Assigned conversation ${id} to ${owner}.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const escalateConversation = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        inbox: d.inbox.map((c) => (c.id === id ? { ...c, status: "escalated", assignee: "Nurse desk" } : c)),
        auditEvents: [audit("inbox.escalate", id, `Escalated conversation ${id} to nurse desk.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const linkConversation = useCallback(
    (id: string, patient?: string) => {
      setData((d) => ({
        ...d,
        inbox: d.inbox.map((c) => (c.id === id ? { ...c, linkedPatient: patient ?? c.patient } : c))
      }));
    },
    []
  );

  const setAccessState = useCallback(
    (reqId: string, state: AccessState, action: string, summary: string) => {
      setData((d) => ({
        ...d,
        accessQueue: d.accessQueue.map((r) => (r.id === reqId ? { ...r, state } : r)),
        auditEvents: [audit(action, reqId, summary), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const holdSlot = useCallback((id: string) => setAccessState(id, "held", "access.hold", `Held a slot for ${id}.`), [setAccessState]);
  const confirmAppointment = useCallback(
    (id: string) => setAccessState(id, "confirmed", "appointment.confirm", `Confirmed appointment ${id}.`),
    [setAccessState]
  );
  const sendMobileLink = useCallback(
    (id: string) => setAccessState(id, "link_sent", "access.mobile_link", `Sent mobile confirmation link for ${id}.`),
    [setAccessState]
  );

  const completeFollowUp = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        followUpQueue: d.followUpQueue.filter((f) => f.id !== id),
        auditEvents: [audit("followup.complete", id, `Completed follow-up step ${id}.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const escalateFollowUp = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        followUpQueue: d.followUpQueue.map((f) => (f.id === id ? { ...f, owner: "Nurse desk", risk: "critical" } : f)),
        auditEvents: [audit("followup.escalate", id, `Escalated follow-up ${id} to nurse desk.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const acceptRecommendation = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        recommendations: d.recommendations.filter((r) => r.id !== id),
        auditEvents: [audit("ai.accept", id, `Accepted AI recommendation ${id} and created a task.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const dismissRecommendation = useCallback(
    (id: string, reason?: string) => {
      setData((d) => ({
        ...d,
        recommendations: d.recommendations.filter((r) => r.id !== id),
        auditEvents: [audit("ai.dismiss", id, `Dismissed AI recommendation ${id}${reason ? ` — ${reason}` : ""}.`), ...d.auditEvents]
      }));
    },
    [audit]
  );

  const setBranch = useCallback((id: string, name: string) => {
    setBranchState({ id, name });
    document.cookie = `hcos_branch=${encodeURIComponent(id)}; path=/; max-age=2592000; samesite=lax`;
  }, []);

  const togglePermission = useCallback((userId: string, key: PermissionKey) => {
    setData((d) => ({
      ...d,
      authContext: {
        ...d.authContext,
        availableUsers: d.authContext.availableUsers.map((u) =>
          u.id === userId
            ? { ...u, permissions: u.permissions.includes(key) ? u.permissions.filter((p) => p !== key) : [...u.permissions, key] }
            : u
        )
      }
    }));
  }, []);

  const patientIdByName = useCallback(
    (name: string) => data.directory.find((p) => p.name === name)?.id,
    [data.directory]
  );

  const badges = useMemo(
    () => ({
      workbench: data.workbench.filter((w) => w.priority === "critical" || w.priority === "high").length,
      inbox: data.inbox.filter((c) => c.status === "new" || c.status === "escalated").length,
      access: data.accessQueue.filter((r) => r.state !== "confirmed").length,
      continuity: data.followUpQueue.filter((f) => f.risk === "critical" || f.risk === "high").length,
      ai: data.recommendations.length
    }),
    [data]
  );

  const value: AppContextValue = {
    data,
    branch,
    badges,
    patientIdByName,
    addPatient,
    addPatientsBulk,
    resolveTask,
    assignConversation,
    escalateConversation,
    linkConversation,
    holdSlot,
    confirmAppointment,
    sendMobileLink,
    completeFollowUp,
    escalateFollowUp,
    acceptRecommendation,
    dismissRecommendation,
    setBranch,
    togglePermission
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

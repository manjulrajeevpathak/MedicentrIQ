import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentsEnabled,
  channelEnabled,
  compileAssistantSystemPrompt,
  defaultAssistantTopics
} from "../src/domain/assistant-policy.js";
import type { AssistantConfig } from "../src/domain/types.js";

const base = (over: Partial<AssistantConfig> = {}): AssistantConfig => ({
  tenantId: "t",
  enabled: true,
  knowledge: [],
  handoffKeywords: [],
  channels: { whatsapp: true, voice: false },
  topics: [],
  medical: { answerable: [], handoffTopics: [] },
  createdAt: "",
  updatedAt: "",
  ...over
});

const compile = (config: AssistantConfig, channel: "whatsapp" | "voice" = "whatsapp") =>
  compileAssistantSystemPrompt({
    orgName: "Trayajyoti Eye Hospital",
    branches: [],
    doctors: [{ displayName: "Dr. Jaideep Dhama", specialty: "Ophthalmology" }],
    config,
    channel
  });

describe("assistant policy compiler", () => {
  it("lists answer topics and hides handoff/off topics from the answer list", () => {
    const config = base({
      topics: [
        { id: "a", key: "pricing", label: "Cost", mode: "answer", content: "OPD and surgery are free." },
        { id: "b", key: "retina", label: "Retina", mode: "handoff" },
        { id: "c", key: "old", label: "Legacy", mode: "off", content: "hidden" }
      ]
    });
    const prompt = compile(config);
    assert.match(prompt, /YOU CAN HELP WITH/);
    assert.match(prompt, /Cost.*OPD and surgery are free/s);
    assert.match(prompt, /DO NOT answer these[\s\S]*Retina/);
    assert.ok(!prompt.includes("Legacy"), "off topics are excluded entirely");
  });

  it("always compiles the no-diagnosis guardrail", () => {
    const prompt = compile(base());
    assert.match(prompt, /Never diagnose/i);
  });

  it("scopes medical: answerable is allowed, everything else handed off", () => {
    const config = base({
      medical: {
        answerable: [{ id: "m", label: "Cataract", content: "Common symptoms: blurry vision, glare." }],
        handoffTopics: ["Retina", "Glaucoma", "LASIK"]
      }
    });
    const prompt = compile(config);
    assert.match(prompt, /Cataract.*blurry vision/s);
    assert.match(prompt, /ALL other clinical[\s\S]*Retina, Glaucoma, LASIK/);
  });

  it("gates the appointment tools on the appointments topic being 'answer'", () => {
    assert.equal(appointmentsEnabled(base()), false);
    const on = base({ topics: [{ id: "x", key: "appointments", label: "Appointments", mode: "answer" }] });
    assert.equal(appointmentsEnabled(on), true);
    assert.match(compile(on), /APPOINTMENTS:.*book an appointment using your tools/s);
    const handoff = base({ topics: [{ id: "x", key: "appointments", label: "Appointments", mode: "handoff" }] });
    assert.equal(appointmentsEnabled(handoff), false);
  });

  it("channel changes only the formatting layer", () => {
    const config = base();
    assert.match(compile(config, "whatsapp"), /WhatsApp formatting only/);
    const voice = compile(config, "voice");
    assert.match(voice, /VOICE call/);
    assert.ok(!voice.includes("WhatsApp formatting only"), "voice drops WhatsApp formatting rules");
  });

  it("channelEnabled + starter defaults behave", () => {
    assert.equal(channelEnabled(base({ channels: { whatsapp: true, voice: false } }), "whatsapp"), true);
    assert.equal(channelEnabled(base({ channels: { whatsapp: true, voice: false } }), "voice"), false);
    const starters = defaultAssistantTopics();
    assert.ok(starters.some((t) => t.key === "appointments" && t.mode === "handoff"), "appointments starts as handoff");
    assert.ok(starters.some((t) => t.key === "pricing" && t.mode === "answer"), "info topics start as answer");
  });
});

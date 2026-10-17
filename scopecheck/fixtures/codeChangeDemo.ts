// Fictional demo project ("Parcel Help", a support assistant) and two example
// code changes with a hand-written impact analysis. Not real code, not a live
// model result. Evidence is quoted text that must appear verbatim in the file.

// The shared data types below are used across the whole app, not just the demo.

// How badly a file is affected, from worst to harmless. Labels live in lib/levels.ts.
export type Level = "breaks" | "update" | "check" | "safe";

// One file in the project being checked. kind decides the verdict wording.
export type ProjectFile = { path: string; kind: "code" | "test" | "doc"; code: string };

// One affected file: its level, a one-line reason, and the exact lines that prove it.
export type Impact = {
  path: string;
  level: Level;
  why: string;
  evidence: string[];
};

// Where the change came from. number and branch are only set for pull requests.
export type PullRequest = { repo: string; number?: number; author: string; branch?: string; base?: string };

// One edited file, as its full text before and after the change.
export type Edit = { path: string; before: string; after: string };

// Everything the main screen shows for one change: what changed and what it affects.
export type CodeChange = {
  id: string;
  title: string;
  pr: PullRequest;
  summary: string;
  edits: Edit[];
  impacts: Impact[];
};

// Samples are written with one edited file inline; `changes` below converts them.
type SampleChange = Omit<CodeChange, "edits"> & Edit;

export const files: ProjectFile[] = [
  {
    path: "src/outbound/canSend.ts",
    kind: "code",
    code: `import type { OutboundMessage } from "../types/message";

export function canSend(msg: OutboundMessage): boolean {
  if (!msg.approvalId) return false;
  return msg.status === "approved";
}`,
  },
  {
    path: "src/outbound/worker.ts",
    kind: "code",
    code: `import { canSend } from "./canSend";
import { logSent } from "../analytics/events";

export async function sendNext(msg: OutboundMessage) {
  if (!canSend(msg)) return queueForReview(msg);
  await deliver(msg);
  logSent({ messageId: msg.id, reviewerId: msg.approvalId!.reviewer });
}`,
  },
  {
    path: "src/types/message.ts",
    kind: "code",
    code: `export type OutboundMessage = {
  id: string;
  body: string;
  approvalId?: { id: string; reviewer: string };
  status: "draft" | "approved" | "sent";
};`,
  },
  {
    path: "src/analytics/events.ts",
    kind: "code",
    code: `import { z } from "zod";

export const ResponseSent = z.object({
  messageId: z.string(),
  reviewerId: z.string(), // every send has a human reviewer
});

export function logSent(e: z.infer<typeof ResponseSent>) {
  track("response_sent", ResponseSent.parse(e));
}`,
  },
  {
    path: "tests/outbound/canSend.test.ts",
    kind: "test",
    code: `import { canSend } from "../../src/outbound/canSend";

test("rejects any message without approvalId", () => {
  expect(canSend(draft({ approvalId: undefined }))).toBe(false);
});

test("sends approved refund replies", () => {
  expect(canSend(draft({ intent: "refund", approved: true }))).toBe(true);
});`,
  },
  {
    path: "src/ui/ReviewQueue.tsx",
    kind: "code",
    code: `export function ReviewQueue({ messages }: Props) {
  // Every outgoing reply waits here for a support agent.
  const waiting = messages.filter((m) => m.status === "draft");
  return (
    <List items={waiting}>
      {(m) => <Row msg={m} action={<Button>Approve</Button>} />}
    </List>
  );
}`,
  },
  {
    path: "tests/e2e/review.spec.ts",
    kind: "test",
    code: `test("agent approves a draft", async ({ page }) => {
  await page.goto("/queue");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Sent")).toBeVisible();
});`,
  },
  {
    path: "src/orders/lookup.ts",
    kind: "code",
    code: `export async function lookupOrder(id: string) {
  const order = await db.orders.find(id);
  if (!order) return { result: "ORDER_NOT_FOUND" as const };
  return { result: "ok" as const, deliveryStatus: order.deliveryStatus };
}`,
  },
  {
    path: "docs/policy/refunds.md",
    kind: "doc",
    code: `# Refund replies

Refund replies must be approved and sent by a support agent.
The assistant never issues a refund on its own.`,
  },
  {
    path: "docs/agent-guide.md",
    kind: "doc",
    code: `# Agent guide

1. Open the review queue.
2. Read the draft and the order details.
3. Click **Approve** to send the reply.`,
  },
  {
    path: "src/billing/receipts.ts",
    kind: "code",
    code: `// Billing receipts are a separate service from support replies.
export async function sendReceipt(paymentId: string) {
  await mailer.send(receiptFor(paymentId));
}`,
  },
];

const sampleChanges: SampleChange[] = [
  {
    id: "auto-ship",
    title: "Auto-send shipping replies",
    pr: { repo: "parcel-help/support-app", number: 482, author: "maya.dev", branch: "auto-ship-replies" },
    summary: "Let the assistant send shipping-status answers without an agent, once the order lookup succeeds.",
    path: "src/outbound/canSend.ts",
    before: `export function canSend(msg: OutboundMessage): boolean {
  if (!msg.approvalId) return false;
  return msg.status === "approved";
}`,
    after: `export function canSend(msg: OutboundMessage): boolean {
  if (msg.intent === "shipping_status" && msg.lookup === "ok") return true;
  if (!msg.approvalId) return false;
  return msg.status === "approved";
}`,
    impacts: [
      {
        path: "src/outbound/worker.ts",
        level: "breaks",
        why: "Auto-sent replies have no approvalId, so this line crashes after delivery.",
        evidence: ["logSent({ messageId: msg.id, reviewerId: msg.approvalId!.reviewer });"],
      },
      {
        path: "src/types/message.ts",
        level: "breaks",
        why: "The new check reads msg.intent and msg.lookup, which the message type doesn't have.",
        evidence: ["export type OutboundMessage = {", 'status: "draft" | "approved" | "sent";'],
      },
      {
        path: "src/analytics/events.ts",
        level: "breaks",
        why: "Every send event must name a reviewer. Auto-sends would be rejected.",
        evidence: ["reviewerId: z.string(), // every send has a human reviewer"],
      },
      {
        path: "tests/outbound/canSend.test.ts",
        level: "update",
        why: "Says no message may send without approval. Needs a shipping exception case.",
        evidence: ['test("rejects any message without approvalId", () => {'],
      },
      {
        path: "src/ui/ReviewQueue.tsx",
        level: "update",
        why: "Assumes every reply waits for an agent. Auto-sent replies would vanish from view.",
        evidence: ["// Every outgoing reply waits here for a support agent."],
      },
      {
        path: "src/orders/lookup.ts",
        level: "check",
        why: 'The change expects lookup === "ok". Confirm that value reaches the message.',
        evidence: ['return { result: "ok" as const, deliveryStatus: order.deliveryStatus };'],
      },
      {
        path: "docs/policy/refunds.md",
        level: "safe",
        why: "Refunds still need an agent. The change only covers shipping status.",
        evidence: ["Refund replies must be approved and sent by a support agent."],
      },
      {
        path: "src/billing/receipts.ts",
        level: "safe",
        why: "Separate service. Doesn't use canSend.",
        evidence: ["// Billing receipts are a separate service from support replies."],
      },
    ],
  },
  {
    id: "button-label",
    title: "Rename the Approve button",
    pr: { repo: "parcel-help/support-app", number: 487, author: "jon.ui", branch: "approve-label" },
    summary: 'Change the review queue button text from "Approve" to "Approve & send".',
    path: "src/ui/ReviewQueue.tsx",
    before: `      {(m) => <Row msg={m} action={<Button>Approve</Button>} />}`,
    after: `      {(m) => <Row msg={m} action={<Button>Approve & send</Button>} />}`,
    impacts: [
      {
        path: "tests/e2e/review.spec.ts",
        level: "breaks",
        why: 'The browser test clicks a button named exactly "Approve".',
        evidence: ['await page.getByRole("button", { name: "Approve" }).first().click();'],
      },
      {
        path: "docs/agent-guide.md",
        level: "update",
        why: "The agent guide tells people to click Approve.",
        evidence: ["3. Click **Approve** to send the reply."],
      },
      {
        path: "src/outbound/canSend.ts",
        level: "safe",
        why: "Sending rules don't change. This is a label only.",
        evidence: ["if (!msg.approvalId) return false;"],
      },
    ],
  },
];

export const changes: CodeChange[] = sampleChanges.map(({ path, before, after, ...c }) => ({
  ...c,
  edits: [{ path, before, after }],
}));

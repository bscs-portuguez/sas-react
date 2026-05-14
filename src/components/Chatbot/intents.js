import { auth } from "../../config/firebase";
import { getUserById } from "../../services/userService";
import { getDocumentsByOrganization } from "../../services/documentService";
import {
  appScope,
  outOfScope,
  statusDefinitions,
  statusDefinitionsBlock,
  pipelineExplanation,
  submissionHowTo,
  helpTopics,
} from "./knowledge";

const STATUS_KEYS = Object.keys(statusDefinitions);

const formatStage = (stage) =>
  stage ? stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;

const formatStatus = (status) =>
  status ? status.replace(/_/g, " ") : "unknown";

const navAction = (label, detail, isAdmin) => ({
  label,
  event: isAdmin ? "adminNavigate" : "pageNavigate",
  detail,
});

async function greetingHandler() {
  return {
    text:
      "Hi! I'm the SAS Portal assistant. I can answer questions about your documents, the approval pipeline, and how to navigate the app. What can I help you with?",
  };
}

async function helpHandler() {
  return { text: helpTopics };
}

async function statusLookupHandler({ isAdmin }) {
  if (isAdmin) {
    return {
      text:
        "As an admin, you can see all submissions in the review pages. Want me to take you there?",
      actions: [
        navAction("Activity Proposals", "activity-proposals", true),
        navAction("Equipment Requests", "equipment-requests", true),
      ],
    };
  }

  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { text: "I can't see who you are right now. Try refreshing the page." };
  }

  try {
    const userDoc = await getUserById(uid);
    if (!userDoc?.organizationId) {
      return {
        text:
          "I don't see an organization linked to your account yet — finish your account setup from the Profile page and I'll be able to look up your submissions.",
        actions: [navAction("Open Profile", "profile", false)],
      };
    }

    const docs = await getDocumentsByOrganization(userDoc.organizationId);
    if (!docs.length) {
      return {
        text:
          "Your organization doesn't have any submissions yet. Want to create one?",
        actions: [
          navAction("New Activity Proposal", "activity-proposals", false),
          navAction("Borrow Equipment", "equipment-borrowing", false),
        ],
      };
    }

    const top = docs
      .slice()
      .sort((a, b) => {
        const aTs = a.lastUpdated?.seconds ?? a.dateSubmitted?.seconds ?? 0;
        const bTs = b.lastUpdated?.seconds ?? b.dateSubmitted?.seconds ?? 0;
        return bTs - aTs;
      })
      .slice(0, 5)
      .map((d) => {
        const label = d.documentNumber || d.title || "(untitled)";
        const status = formatStatus(d.status);
        const stage = formatStage(d.pipeline?.currentStage);
        const stageNote = stage ? ` — currently at ${stage}` : "";
        return `• ${label}: ${status}${stageNote}`;
      })
      .join("\n");

    return {
      text: `Here are your organization's most recent submissions:\n${top}\n\nTap a page below to see the full details.`,
      actions: [
        navAction("Activity Proposals", "activity-proposals", false),
        navAction("Equipment Borrowing", "equipment-borrowing", false),
      ],
    };
  } catch (err) {
    console.error("Chatbot status lookup failed:", err);
    return {
      text:
        "I couldn't fetch your submissions just now. Please try again in a moment, or open the Activity Proposals page directly.",
      actions: [navAction("Activity Proposals", "activity-proposals", false)],
    };
  }
}

async function submitProposalHandler({ isAdmin }) {
  if (isAdmin) {
    return {
      text:
        "Admins don't submit proposals here — student organizations do. From the admin side you can review the proposals queue.",
      actions: [navAction("Activity Proposals (Admin)", "activity-proposals", true)],
    };
  }
  return {
    text: submissionHowTo.proposal,
    actions: [navAction("Open Activity Proposals", "activity-proposals", false)],
  };
}

async function submitEquipmentHandler({ isAdmin }) {
  if (isAdmin) {
    return {
      text:
        "Admins don't borrow equipment here — student organizations do. From the admin side you can review and release equipment requests.",
      actions: [navAction("Equipment Requests (Admin)", "equipment-requests", true)],
    };
  }
  return {
    text: submissionHowTo.equipment,
    actions: [navAction("Open Equipment Borrowing", "equipment-borrowing", false)],
  };
}

async function navigateProfileHandler({ isAdmin }) {
  return {
    text: "The Profile page is where you can change your password and update your account details.",
    actions: [navAction("Open Profile", "profile", isAdmin)],
  };
}

async function navigateHomeHandler({ isAdmin }) {
  return {
    text: isAdmin
      ? "The admin dashboard shows verification queue and overall stats."
      : "The Home page shows released memorandums and announcements.",
    actions: [
      isAdmin
        ? navAction("Open Dashboard", "dashboard", true)
        : navAction("Open Home", "home", false),
    ],
  };
}

async function statusMeaningHandler(_, text) {
  const lowered = text.toLowerCase();
  const matched = STATUS_KEYS.find((key) =>
    lowered.includes(key.replace(/_/g, " ")) || lowered.includes(key),
  );
  if (matched) {
    return { text: statusDefinitions[matched] };
  }
  return { text: statusDefinitionsBlock };
}

async function pipelineExplainHandler() {
  return { text: pipelineExplanation };
}

async function appScopeHandler() {
  return { text: appScope };
}

async function notCoveredHandler() {
  return { text: outOfScope };
}

async function fallbackHandler() {
  return {
    text:
      "Sorry, I didn't quite catch that. Here are some things I can help with — tap one or rephrase your question.",
  };
}

const intents = [
  {
    id: "greeting",
    patterns: [/^\s*(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i],
    handler: greetingHandler,
  },
  {
    id: "help",
    patterns: [/^\s*(help|topics|what can you do|menu|\?)\s*$/i, /\bwhat can you (do|help)\b/i],
    handler: helpHandler,
  },
  {
    id: "status_lookup",
    patterns: [
      /\bmy (document|documents|proposal|proposals|request|requests|submission|submissions)\b/i,
      /\bwhere is (my|the)\b/i,
      /\btrack\b/i,
      /\bstatus of\b/i,
      /\b(check|see|view) (status|my)\b/i,
      /\bwhat'?s the status\b/i,
    ],
    handler: statusLookupHandler,
  },
  {
    id: "submit_proposal",
    patterns: [
      /\b(submit|create|file|make|new)\b.*\bproposal\b/i,
      /\bproposal\b.*\b(submit|create|file|how)\b/i,
      /\bactivity proposal\b/i,
    ],
    handler: submitProposalHandler,
  },
  {
    id: "submit_equipment",
    patterns: [
      /\b(borrow|request|rent|reserve)\b.*\b(equipment|item|chair|table|sound|projector)\b/i,
      /\bequipment\b.*\b(borrow|request|how)\b/i,
      /\bequipment (borrowing|request)\b/i,
    ],
    handler: submitEquipmentHandler,
  },
  {
    id: "navigate_profile",
    patterns: [/\b(profile|account settings|change (my )?password|update.*account)\b/i],
    handler: navigateProfileHandler,
  },
  {
    id: "navigate_home",
    patterns: [/\b(home page|dashboard|main page|announcements|memorandum)\b/i],
    handler: navigateHomeHandler,
  },
  {
    id: "status_meaning",
    patterns: [
      /\b(what does|what is|meaning of|define)\b.*\b(pending|under review|approved|returned|rejected|released)\b/i,
      /\b(pending|under review|approved|returned|rejected|released)\b.*\bmean\b/i,
      /\bstatus (mean|meaning|definitions?)\b/i,
    ],
    handler: statusMeaningHandler,
  },
  {
    id: "pipeline_explain",
    patterns: [
      /\b(pipeline|stages?|workflow|approval process|approval flow)\b/i,
      /\b(isg endorsement|sas review|vpaa|op approval|fms|procurement|isg distribution)\b/i,
      /\bhow (does|do) (approval|the process|proposals get approved)\b/i,
    ],
    handler: pipelineExplainHandler,
  },
  {
    id: "not_covered",
    patterns: [
      /\b(grades?|transcript|enrollment|enroll|tuition|payment|registration|schedules?|faculty|professor)\b/i,
      /\b(what (does|doesn'?t) (this|the) (app|portal|system) (not )?(cover|do|handle))\b/i,
    ],
    handler: notCoveredHandler,
  },
  {
    id: "app_scope",
    patterns: [
      /\bwhat (is|does) this (app|portal|site|system|web ?app)\b/i,
      /\bwhat can i do (here|in this app|in the portal)\b/i,
      /\bwhat does this (cover|do)\b/i,
      /\babout (this )?(app|portal|system)\b/i,
    ],
    handler: appScopeHandler,
  },
];

export async function matchIntent(rawText, ctx) {
  const text = rawText.trim();
  if (!text) return fallbackHandler(ctx, text);
  for (const intent of intents) {
    if (intent.patterns.some((p) => p.test(text))) {
      const result = await intent.handler(ctx, text);
      return { ...result, intentId: intent.id };
    }
  }
  const result = await fallbackHandler(ctx, text);
  return { ...result, intentId: "fallback" };
}

export const quickReplies = [
  "Check my document status",
  "How do I submit a proposal?",
  "What does this app do?",
  "Explain status terms",
];

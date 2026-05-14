export const appScope = [
  "The EARIST Student Affairs System (SAS) Portal is for student organizations to",
  "submit and track activity proposals and equipment-borrowing requests, and for",
  "the SAS office to route those documents through the approval pipeline",
  "(ISG → SAS → VPAA → OP, with FMS/Procurement for ISG-submitted proposals).",
  "",
  "You can use it to:",
  "• Submit activity proposals and upload the required documents",
  "• Borrow equipment from the SAS inventory",
  "• Track the status and pipeline stage of anything you've submitted",
  "• See released memorandums and announcements on the Home page",
].join("\n");

export const outOfScope = [
  "This portal only covers Student Affairs documents. It does NOT handle:",
  "• Grades, transcripts, or academic records",
  "• Enrollment, course registration, or schedules",
  "• Tuition payments or financial aid",
  "• Faculty evaluations or class-related concerns",
  "",
  "For those, please contact the relevant EARIST office directly.",
].join("\n");

export const statusDefinitions = {
  pending:
    "Pending — your submission is in the queue waiting for the next reviewer to pick it up.",
  under_review:
    "Under review — a reviewer is currently looking at your submission.",
  approved:
    "Approved — your submission has cleared review and is moving to the next stage of the pipeline.",
  returned:
    "Returned — a reviewer sent it back for revision. Check the remarks, edit your submission, and resubmit.",
  rejected:
    "Rejected — the submission was declined. See the remarks for the reason; you may need to start over.",
  released:
    "Released — the document has been fully approved and released back to your organization.",
};

export const statusDefinitionsBlock = [
  "Status meanings:",
  ...Object.values(statusDefinitions).map((line) => `• ${line}`),
].join("\n");

export const pipelineExplanation = [
  "Activity proposal pipeline (organization-submitted):",
  "  1. ISG Endorsement — your ISG officers review and endorse",
  "  2. SAS Review — Student Affairs reviews and prepares an endorsement letter",
  "  3. VPAA Review — Vice President for Academic Affairs reviews",
  "  4. OP Approval — Office of the President signs off",
  "  5. SAS Release — SAS releases the approved document back to ISG",
  "  6. ISG Distribution — ISG marks it as distributed to your organization",
  "",
  "If ISG is the submitter, the pipeline skips ISG endorsement and adds an FMS",
  "review and Procurement review after OP approval.",
].join("\n");

export const submissionHowTo = {
  proposal: [
    "To submit an activity proposal:",
    "  1. Go to the 'Activity Proposals' page from the sidebar.",
    "  2. Click 'Submit New Proposal'.",
    "  3. Fill in the activity details and upload the required documents.",
    "  4. Submit. You can track its status on the same page.",
  ].join("\n"),
  equipment: [
    "To borrow equipment:",
    "  1. Go to the 'Equipment Borrowing' page from the sidebar.",
    "  2. Click 'New Request'.",
    "  3. Pick the equipment from the inventory, set borrow/return dates, and",
    "     (optionally) link an approved activity proposal.",
    "  4. Submit. SAS will review, approve, and release the equipment for pickup.",
  ].join("\n"),
};

export const helpTopics = [
  "I can help you with:",
  "• Checking the status of your documents and proposals",
  "• Explaining what a status (pending, returned, released, etc.) means",
  "• Walking you through how to submit a proposal or borrow equipment",
  "• Explaining the approval pipeline (ISG → SAS → VPAA → OP)",
  "• Telling you what this portal does (and what it doesn't)",
  "",
  "Just ask in your own words, or tap one of the suggestions below.",
].join("\n");

// ---------------------------------------------------------------------------
// Notification Templates
// ---------------------------------------------------------------------------

interface NotificationContent {
  subject: string;
  body: string;
}

// ---- Tournament Lifecycle -------------------------------------------------

function tournamentActivated(p: {
  county: string;
  tournamentName: string;
  playerName: string;
}): NotificationContent {
  return {
    subject: `Your ${p.county} tournament has started!`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>The <b>${p.tournamentName}</b> in ${p.county} is now active. Check your dashboard for your first match-ups and start scheduling!</p>`,
  };
}

function roundRobinWeekWarning(p: {
  tournamentName: string;
  playerName: string;
}): NotificationContent {
  return {
    subject: "One week left in round-robin",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>There are <b>7 days</b> remaining in the round-robin phase of <b>${p.tournamentName}</b>. Make sure all your matches are played and scores submitted before the deadline.</p>`,
  };
}

function finalsCreated(p: {
  tournamentName: string;
  playerName: string;
}): NotificationContent {
  return {
    subject: "You made the finals!",
    body: `<p>Congrats <b>${p.playerName}</b>!</p>
<p>You've advanced to the finals of <b>${p.tournamentName}</b>. Head to your dashboard to see the bracket and start scheduling.</p>`,
  };
}

function tournamentComplete(p: {
  tournamentName: string;
  playerName: string;
}): NotificationContent {
  return {
    subject: "Tournament complete! Standings inside",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p><b>${p.tournamentName}</b> has wrapped up. Check your dashboard for the final standings and stats. Thanks for playing!</p>`,
  };
}

// ---- Scheduling: Tier 2 (Flex) --------------------------------------------

function tier2MatchCreated(p: {
  playerName: string;
  opponentName: string;
  flexMinutes: number;
}): NotificationContent {
  return {
    subject: `Can you flex ${p.flexMinutes} min for your match vs ${p.opponentName}?`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>A new match has been created against <b>${p.opponentName}</b>. You have up to <b>${p.flexMinutes} minutes</b> of flex time available. Head to your dashboard to confirm or adjust the schedule.</p>`,
  };
}

function tier2Reminder1(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Reminder: flex scheduling needed",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> still needs flex scheduling. Please confirm your availability soon — you have <b>4 days</b> remaining.</p>`,
  };
}

function tier2Reminder2(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "2 days left to schedule",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Only <b>2 days left</b> to schedule your match against <b>${p.opponentName}</b>. Please finalize your flex time today to avoid auto-scheduling.</p>`,
  };
}

function tier2FinalWarning(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Last chance \u2014 auto-scheduled tomorrow",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>This is your <b>last chance</b> to schedule your match against <b>${p.opponentName}</b>. If no action is taken by tomorrow, the system will auto-schedule it for you.</p>`,
  };
}

function tier2AutoFlexed(p: {
  playerName: string;
  opponentName: string;
  datetime: string;
}): NotificationContent {
  return {
    subject: "Match auto-scheduled to keep things moving",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> has been auto-scheduled for <b>${p.datetime}</b>. If this time doesn't work, reach out to your opponent as soon as possible.</p>`,
  };
}

// ---- Scheduling: Tier 3 (Propose & Pick) ----------------------------------

function tier3MatchCreated(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: `Propose times for your match vs ${p.opponentName}`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>A new match has been created against <b>${p.opponentName}</b>. Please propose at least 3 available times from your dashboard so your opponent can pick one.</p>`,
  };
}

function tier3ProposeReminder(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Still need to propose times",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>You haven't proposed times for your match against <b>${p.opponentName}</b> yet. Please submit your availability soon — <b>4 days</b> remaining before the system steps in.</p>`,
  };
}

function tier3ProposeFinalWarning(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "System will auto-propose tomorrow",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Last call to propose times for your match against <b>${p.opponentName}</b>. If you don't submit availability by tomorrow, the system will auto-propose times on your behalf.</p>`,
  };
}

function tier3AutoProposed(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: `We proposed times \u2014 ${p.opponentName} will pick`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Since no times were proposed, the system has auto-generated available slots for your match against <b>${p.opponentName}</b>. Your opponent will pick one shortly.</p>`,
  };
}

function tier3ProposalsReceived(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: `${p.opponentName} proposed 3 times \u2014 pick one!`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p><b>${p.opponentName}</b> has proposed times for your match. Head to your dashboard and pick the slot that works best for you.</p>`,
  };
}

function tier3PickReminder(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Don't forget to pick a time",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>You still need to pick a time for your match against <b>${p.opponentName}</b>. Please select one of the proposed slots — <b>3 days</b> left before auto-scheduling kicks in.</p>`,
  };
}

function tier3PickFinalWarning(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Auto-scheduled to earliest time tomorrow",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Tomorrow the system will auto-select the <b>earliest proposed time</b> for your match against <b>${p.opponentName}</b>. Pick a time now if you have a preference.</p>`,
  };
}

function tier3AutoAccepted(p: {
  playerName: string;
  opponentName: string;
  datetime: string;
}): NotificationContent {
  return {
    subject: `Match confirmed for ${p.datetime}`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> has been auto-confirmed for <b>${p.datetime}</b>. If you need to make changes, contact your opponent directly.</p>`,
  };
}

// ---- Match Confirmed ------------------------------------------------------

function matchScheduledByPlayer(p: {
  playerName: string;
  opponentName: string;
  datetime: string;
}): NotificationContent {
  return {
    subject: `Match confirmed: ${p.datetime} vs ${p.opponentName}`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> is locked in for <b>${p.datetime}</b>. Good luck out there!</p>`,
  };
}

// ---- Scores ---------------------------------------------------------------

function scoreReminder(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "How'd it go? Submit your score",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> was yesterday. Head to your dashboard to submit the score so standings stay up to date.</p>`,
  };
}

function scoreMissing(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Score needed by tomorrow",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>We still don't have a score for your match against <b>${p.opponentName}</b>. Please submit it by <b>tomorrow</b> or the match may be recorded as a no-show.</p>`,
  };
}

function scoreSubmitted(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: `${p.opponentName} reported the score \u2014 confirm?`,
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p><b>${p.opponentName}</b> has submitted a score for your match. Please review and confirm it from your dashboard.</p>`,
  };
}

function scoreConfirmReminder(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Auto-confirms in 24 hours",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>The score submitted by <b>${p.opponentName}</b> will be <b>auto-confirmed in 24 hours</b>. If the score is incorrect, dispute it now from your dashboard.</p>`,
  };
}

function scoreConfirmed(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Match result confirmed",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>The result for your match against <b>${p.opponentName}</b> has been confirmed. Standings have been updated.</p>`,
  };
}

// ---- Forfeits -------------------------------------------------------------

function singleForfeitResponsive(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Match forfeited in your favor",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> has been recorded as a forfeit. You receive the win. Standings have been updated.</p>`,
  };
}

function singleForfeitForfeited(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Match recorded as a forfeit",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> has been recorded as a forfeit. The loss has been applied to your record. Please make sure to schedule and play future matches on time.</p>`,
  };
}

function mutualNoShow(p: {
  playerName: string;
  opponentName: string;
}): NotificationContent {
  return {
    subject: "Match recorded as mutual no-show",
    body: `<p>Hi <b>${p.playerName}</b>,</p>
<p>Your match against <b>${p.opponentName}</b> has been recorded as a <b>mutual no-show</b>. Both players receive a loss. Please prioritize scheduling going forward.</p>`,
  };
}

// ---------------------------------------------------------------------------
// Template Registry
// ---------------------------------------------------------------------------

export const NOTIFICATION_TEMPLATES = {
  // Tournament lifecycle
  "N-01": tournamentActivated,
  "N-02": roundRobinWeekWarning,
  "N-03": finalsCreated,
  "N-04": tournamentComplete,

  // Scheduling: Tier 2 (Flex)
  "N-10": tier2MatchCreated,
  "N-11": tier2Reminder1,
  "N-12": tier2Reminder2,
  "N-13": tier2FinalWarning,
  "N-14": tier2AutoFlexed,

  // Scheduling: Tier 3 (Propose & Pick)
  "N-20": tier3MatchCreated,
  "N-21": tier3ProposeReminder,
  "N-22": tier3ProposeFinalWarning,
  "N-23": tier3AutoProposed,
  "N-24": tier3ProposalsReceived,
  "N-25": tier3PickReminder,
  "N-26": tier3PickFinalWarning,
  "N-27": tier3AutoAccepted,

  // Match confirmed
  "N-30": matchScheduledByPlayer,

  // Scores
  "N-40": scoreReminder,
  "N-41": scoreMissing,
  "N-42": scoreSubmitted,
  "N-43": scoreConfirmReminder,
  "N-44": scoreConfirmed,

  // Forfeits
  "N-50-responsive": singleForfeitResponsive,
  "N-50-forfeited": singleForfeitForfeited,
  "N-51": mutualNoShow,
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TEMPLATES;

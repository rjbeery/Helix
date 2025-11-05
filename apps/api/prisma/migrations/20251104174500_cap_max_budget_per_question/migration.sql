-- Enforce a hard cap on per-question budget at 500 cents by clamping existing rows.
-- You can adjust this to match process.env.MAX_PER_Q_CENTS if different in your deployment.

UPDATE "User"
SET "maxBudgetPerQuestion" = LEAST("maxBudgetPerQuestion", 500);

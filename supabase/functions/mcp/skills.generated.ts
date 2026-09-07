// Neutral built-in examples for the review snapshot. Custom skills are stored per user.
export const SKILLS: Record<string, string> = {
  "planning-review": "Review open goals and tasks with the user. Identify a small set of next actions based on their stated priorities. Distinguish observations from assumptions. Ask before changing records when authorization is unclear. Do not infer personal history that is absent from the available data.",
  "prediction-review": "Help formulate a falsifiable prediction with a confidence level and resolution date. Review resolved predictions against their original wording. Record uncertainty and avoid treating a single outcome as proof of calibration.",
  "experiment-review": "Help define a bounded experiment with a question, an observable outcome, and a review date. Summarize logged observations separately from interpretation. Ask the user before drawing conclusions from incomplete evidence."
};

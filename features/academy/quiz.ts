import type { QuizQuestion } from './services';

/**
 * Pure quiz grading — used by the server action so the score is ALWAYS
 * computed from the lesson's stored correct answers, never trusted from the
 * client. Kept dependency-free for direct unit testing.
 */
export function gradeQuiz(
  quiz: QuizQuestion[],
  answers: number[]
): { perQuestion: boolean[]; score: number; passed: boolean; passScore: number } {
  const perQuestion = quiz.map((q, i) => answers[i] === q.correct);
  const correctCount = perQuestion.filter(Boolean).length;
  const score = Math.round((correctCount * 100) / quiz.length);
  return { perQuestion, score, passed: false, passScore: 0 };
}

/** Resolve pass/fail against the lesson's pass score (separate for clarity). */
export function withPassResult(
  result: ReturnType<typeof gradeQuiz>,
  passScore: number
): { perQuestion: boolean[]; score: number; passed: boolean; passScore: number } {
  return { ...result, passed: result.score >= passScore, passScore };
}

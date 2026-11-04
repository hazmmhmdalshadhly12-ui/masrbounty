/**
 * Pure-logic tests for the Academy quiz grading (server-side grading is a
 * security property: the client only sends answer indices).
 */
import { gradeQuiz, withPassResult } from '@/features/academy/quiz';
import type { QuizQuestion } from '@/features/academy/services';

const QUIZ: QuizQuestion[] = [
  { q: 'ما هو XSS؟', options: ['حقن سكربت', 'حقن SQL', 'تجاوز تدفق'], correct: 0, explanation: 'XSS = حقن سكربت في الصفحة' },
  { q: 'أين تجرب SQL Injection؟', options: ['موقع حقيقي', 'مختبر محلي', 'حساب زميل'], correct: 1 },
  { q: 'ثالثة', options: ['أ', 'ب', 'ج', 'د'], correct: 3 },
];

describe('academy quiz grading', () => {
  it('computes per-question correctness and percent score', () => {
    const g = gradeQuiz(QUIZ, [0, 1, 3]);
    expect(g.perQuestion).toEqual([true, true, true]);
    expect(g.score).toBe(100);
  });

  it('rounds scores correctly (1/3 correct = 33%)', () => {
    const g = gradeQuiz(QUIZ, [0, 0, 0]);
    expect(g.perQuestion).toEqual([true, false, false]);
    expect(g.score).toBe(33);
  });

  it('zero correct answers → 0', () => {
    const g = gradeQuiz(QUIZ, [1, 0, 0]);
    expect(g.score).toBe(0);
  });

  it('pass/fail respects the lesson pass score', () => {
    const g = gradeQuiz(QUIZ, [0, 1, 0]); // 66%
    expect(withPassResult(g, 70).passed).toBe(false);
    expect(withPassResult(g, 60).passed).toBe(true);
    expect(withPassResult(g, 70).passScore).toBe(70);
  });
});

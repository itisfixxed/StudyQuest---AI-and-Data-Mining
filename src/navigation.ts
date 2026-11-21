export const routes = {
  dashboard: 'Dashboard', journey: 'Learning Journey', practice: 'Practice', boss: 'Boss Battles',
  exam: 'Exam Arena', notebook: 'Mistake Notebook', library: 'Formula Library', planner: 'Study Planner',
  statistics: 'Statistics', settings: 'Settings'
} as const;
export type Route = keyof typeof routes;
export function currentRoute(): Route {
  const hash = location.hash.slice(1);
  return Object.hasOwn(routes, hash) ? hash as Route : 'dashboard';
}


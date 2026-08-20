import type { SkillCategory } from "@intern-platform/shared";

/**
 * Curated catalog of recognized skills, mirroring Skill.category. Matching
 * against a known dictionary (rather than treating every comma-separated
 * token as a skill) keeps extraction precise and avoids false positives
 * from common English words appearing in a resume.
 *
 * Key = lowercase match key, value = canonical display name + category.
 */
export const SKILLS_DICTIONARY: Record<string, { name: string; category: SkillCategory }> = {};

function register(category: SkillCategory, names: string[]): void {
  for (const name of names) {
    SKILLS_DICTIONARY[name.toLowerCase()] = { name, category };
  }
}

register("LANGUAGE", [
  "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Golang", "Rust",
  "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Perl", "Dart", "SQL", "Bash", "Shell",
]);

register("FRAMEWORK", [
  "React", "React.js", "Angular", "Vue", "Vue.js", "Next.js", "Nuxt.js", "Express", "Express.js",
  "Django", "Flask", "FastAPI", "Spring", "Spring Boot", "Node.js", "Rails", "Ruby on Rails",
  "Laravel", "ASP.NET", ".NET", "TensorFlow", "PyTorch", "Keras", "scikit-learn", "jQuery",
  "Bootstrap", "Tailwind CSS", "Redux", "GraphQL",
]);

register("DATABASE", [
  "MySQL", "PostgreSQL", "Postgres", "MongoDB", "SQLite", "Redis", "Oracle", "SQL Server",
  "DynamoDB", "Cassandra", "Firebase", "MariaDB", "Elasticsearch",
]);

register("CLOUD", [
  "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "Terraform", "Heroku",
  "Vercel", "Netlify", "Lambda", "EC2", "S3",
]);

register("TOOL", [
  "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Postman", "Linux", "Unix", "VS Code",
  "Figma", "Jenkins", "CI/CD", "REST APIs", "REST", "Webpack", "Vite", "npm", "Selenium",
  "JUnit", "Agile", "Scrum",
]);

/** Case-insensitive exact-token lookup, e.g. "python" → {name:"Python", category:"LANGUAGE"}. */
export function lookupSkill(token: string): { name: string; category: SkillCategory } | null {
  return SKILLS_DICTIONARY[token.trim().toLowerCase()] ?? null;
}

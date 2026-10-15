import { describe, expect, it } from "vitest";
import { checkMigrations, parseMigrationFiles } from "../../scripts/lib/migration-check.mjs";

const repo = { "20261001000000": "base", "20261010000000": "feature-a", "20261015000000": "feature-b" };

describe("parseMigrationFiles", () => {
  it("reads version and name and reports malformed files", () => {
    expect(parseMigrationFiles(["20261001000000_base.sql", "README.md", "20261001_bad.sql", "20261002000000_Bad_Name.sql"])).toEqual({
      migrations: { "20261001000000": "base" },
      invalid: ["20261001_bad.sql", "20261002000000_Bad_Name.sql"],
    });
  });
});

describe("checkMigrations", () => {
  it("passes when the branch has everything and the parent only lacks the newest files", () => {
    const result = checkMigrations({ repo, branch: repo, parent: { "20261001000000": "base" } });
    expect(result).toEqual({ ok: true, problems: [], pending: ["20261010000000_feature-a", "20261015000000_feature-b"] });
  });

  it("passes with nothing pending after the release", () => {
    expect(checkMigrations({ repo, branch: repo, parent: repo })).toEqual({ ok: true, problems: [], pending: [] });
  });

  it("flags files not applied to the branch and migrations applied without a file", () => {
    const result = checkMigrations({
      repo,
      branch: { "20261001000000": "base", "20261010000000": "feature-a", "20261012000000": "applied-by-hand" },
      parent: {},
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      "Not applied to the branch: 20261015000000_feature-b",
      "Applied to the branch without a file in migrations/: 20261012000000_applied-by-hand",
    ]);
  });

  it("flags drift on the parent and renamed migrations", () => {
    const result = checkMigrations({
      repo,
      branch: { ...repo, "20261010000000": "feature-a-renamed" },
      parent: { "20261001000000": "base", "20261005000000": "hotfix-in-production" },
    });
    expect(result.problems).toEqual([
      "Name differs on the branch: 20261010000000_feature-a vs 20261010000000_feature-a-renamed",
      "Applied to the parent without a file in migrations/: 20261005000000_hotfix-in-production",
    ]);
  });

  it("flags pending files older than the parent head, which the CLI refuses to apply", () => {
    const result = checkMigrations({ repo, branch: repo, parent: { "20261001000000": "base", "20261015000000": "feature-b" } });
    expect(result.pending).toEqual(["20261010000000_feature-a"]);
    expect(result.problems).toEqual(["Pending but older than the parent head (20261015000000); the CLI will refuse it: 20261010000000_feature-a"]);
  });
});

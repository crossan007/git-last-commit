export interface Contributor {
  name: string;
  email: string;
}
export interface Commit {
  shortHash: string;
  hash: string;
  subject: string;
  sanitizedSubject: string;
  body: string;
  authoredOn: string;
  committedOn: string;
  author: Contributor;
  committer: Contributor;
  notes?: string;
}
export interface RepoInfo {
  commit: Commit;
  head: string;
  tags: string[];
  status: string[];
  isDirty: boolean;
}
export interface Options {
  dst: string;
}

type GetLastCommitCallback = (err: Error | null, commit: Commit) => void;

export const getRepoInfo: ()=>Promise<RepoInfo>;

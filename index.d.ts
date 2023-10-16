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

export interface Patch {
  fileA: string
  fileB: string
  extendedHeaders: string[]
  patchBody: string
}


type GetLastCommitCallback = (err: Error | null, commit: Commit) => void;

export const getRepoInfo: ()=>Promise<RepoInfo>;
export const getLog: (props: {upstream: string})=>Promise<any>
export const getConventionalCommitStats: (commits: Commit[])=>Promise<any>;
export const getRevList: (branch: string)=>Promise<any>;
export const getPatches: (upstream: string)=> Patch[]
export const getTodos: (patches: Patch[], jiraProjectKey: string)=>any
/**
 * Adapted from https://github.com/seymen/git-last-commit
 */
 const process = require('child_process');
 const executeCommand = (command, options) => {
   return new Promise((resolve,reject) =>{
     process.exec(command, {}, function(err, stdout, stderr) {
       if (stderr) {
         reject(stderr)
         return
       }
       resolve(stdout)
     })
   });
 }

 const parseConventionalCommit = (commit) => {
  const conventionalRegex = new RegExp(/^(?<type>feat|feature|fix|build|chore|ci|docs|style|refactor|perf|test)(?:\((?<scope>.*)\))?(?<breaking>!)?:\s(?<description>.*?)$[\s]?(?<body>[\s\S]*?)?/gim)
  const match_result = conventionalRegex.exec(commit.rawBody)
  if (!match_result) {
    return false
  }
  const retVal = {
    ...match_result.groups,
    breaking: (
      match_result.groups["breaking"] == "!" ||
      (/BREAKING CHANGE/i).test(commit.rawBody)
    ),
    body: typeof(match_result.groups["body"]) == "string" ? match_result.groups["body"].trim() : ""
  }
  return retVal;
}

const getConventionalCommitStats = (commits)=>{
  let retVal = {
    nonConforming: 0,
    types: {},
    scopes: {},
    breakingChanges: 0
  };
  commits.forEach((v,i,a)=>{
    if (v.conventionalCommit == false) {
      retVal.nonConforming += 1;
    }
    else {
      //Increment the Types
      if (!retVal.types[v.conventionalCommit.type]) {
        retVal.types[v.conventionalCommit.type] = 0
      }
      retVal.types[v.conventionalCommit.type] += 1;
      // Increment breaking changes
      retVal.breakingChanges += v.conventionalCommit.breaking;
      //Increment the scopes
      if (v.conventionalCommit.scope) {
        if (!retVal.scopes[v.conventionalCommit.scope]) {
          retVal.scopes[v.conventionalCommit.scope] = 0
        }
        retVal.scopes[v.conventionalCommit.scope] += 1;
      }
    }
  })
  return retVal
}
 
 const getLog = async ({count,upstream}) =>{
   const fieldSplitCharacter = '<##>';
   const itemSplitCharacter = '<###>'
   const LogAttributes = [
     {symbol: "%h", name: "shortHash"}, 
     {symbol: "%H", name: "hash"}, 
     {symbol: "%s", name: "subject"}, 
     {symbol: "%f", name: "sanitizedSubject"}, 
     {symbol: "%B", name: "rawBody"},
     {symbol: "%b", name: "body"}, 
     {symbol: "%at", name: "authoredOn"}, 
     {symbol: "%ct", name: "committedOn"}, 
     {symbol: "%an", name: "author.name"}, 
     {symbol: "%ae", name: "author.email"}, 
     {symbol: "%cn", name: "committer.name"}, 
     {symbol: "%ce", name: "committer.email"}, 
     {symbol: "%N", name: "notes"},
     {symbol: "%(trailers)", name: "trailers"}
   ]
   const command =  `git log ${upstream ? upstream+"..HEAD" :''} ${count ? '-'+count : ''} --pretty=format:"` + itemSplitCharacter + LogAttributes.map(f=>f.symbol).join(fieldSplitCharacter) +'"';
   const res = await executeCommand(command);
   const logItems= res.split(itemSplitCharacter)
    .filter(n=>n)
    .map(item=>{ 
      let response = {};
      item.substring(0,item.length-1).split(fieldSplitCharacter).forEach((d,i,a) => {
      const keyName = LogAttributes[i%LogAttributes.length].name
      if (keyName.includes(".")) {
        const keyParts = keyName.split(".")
        if (! response.hasOwnProperty(keyParts[0])) {
          response [keyParts[0]] = {}
        }
        response [keyParts[0]][keyParts[1]] = d
      }
      else {
        response[keyName] = d;
      }
    })
    response.conventionalCommit = parseConventionalCommit(response)
    return response
  })
   return logItems
 }
 
 const getHead = async ()=> {
   const command =  'git rev-parse --abbrev-ref HEAD'
   return (await executeCommand(command)).split("\n").filter(n=>n)[0]
 }
 
 const getTags = async ()=> {
   const command =  'git tag --contains HEAD'
   return (await executeCommand(command)).split("\n").filter(n=>n)
 }
 
 const getStatus = async() => {
   const command =  'git status --porcelain'
   const status = (await executeCommand(command)).split("\n").filter(n=>n)
   return status;
 }
 
 const getRepoInfo = async () => {
   const [commits, head, tag, status] = await Promise.all([
     getLog({count: 1}),
     getHead(),
     getTags(),
     getStatus()
   ]);
   const o = {
     commit: commits[0],
     head: head,
     tags: tag,
     status: status,
     isDirty: status.length > 0
   }
   return o;
 }

 /**
  * Gets the diff of the current working copy against an upstream branch;
  * returns an array of diff objects with the filenames, extended headers, and patchbody
  * as properties on the object.
  * 
  * @param {string} upstream The upstream branch against which the working copy should be diff'd
  * @returns 
  */
 async function getPatches(upstream)  {
  return new Promise((resolve,reject) => {
    let patch_buffer = ""
    
    const child = process.spawn('git', [`diff ${upstream}`], { shell: true})

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function(data) {
      patch_buffer += data
    });

    child.on('close', function(code) {
      const patchHeaderRegex = new RegExp(/(diff --git a\/.*? b\/.*?\n)/)
      const patches_split = patch_buffer.split(patchHeaderRegex)
        .filter(n=>n)
        .map((element,index,array) => {
          if (index % 2 == 0) {
            return;
          }
          return array[index-1] + element
        })
        .filter(n=>n)
  
      //log("split ", patches_split)
      const patches_parsed = patches_split.map((s)=> {
        const patchRegex = new RegExp(/^diff --git a\/(?<fileA>.*?) b\/(?<fileB>.*?)$\n^(?<extendedHeaders>[\s\S]+?)\n^--- a?(?<fileRemoved>\/.*?)$\n^\+\+\+ b?(?<fileAdded>\/.*?)$\n^(?<patchBody>[\s\S]*)/im)
        const match_result = patchRegex.exec(s);
        if (!match_result) {
          return;
        }
        const { fileA, fileB, extendedHeaders, fileRemoved,fileAdded, patchBody} = match_result.groups
        return {
          fileA: fileA,
          fileB: fileB,
          extendedHeaders: (typeof(extendedHeaders) == "string" && extendedHeaders.split('\n').filter(n=>n)),
          patchBody: patchBody
        }
      })
      .filter(n=>n)
      resolve(patches_parsed);
    });   
  })
}

async function getRevList(upstream){
  const result = await executeCommand(`git rev-list --count --left-right ${upstream}..HEAD`);
  return ((/(?<behind>\d+)\s+(?<ahead>\d+)/).exec(result)).groups
}

/**
 * Gets all instances of "todo" in comment lines
 * checks whether a JIRA-like key exists on the TODO line
 * 
 * a todo line may be ignored by placing @ci-ignore anywhere in the line.
 * 
 * @param {*} patches an array of patches generated by `getPatches`
 * @returns 
 */
async function getTodos(patches, jiraProjectKey) {  /** */
  let todos = []
  patches.forEach((p) => {
    /** This regex starts with a postitive lookahead to ensure that the 
     * diff line contains something that looks like a TODO inside a comment block, @ci-ignore 
     * and then parses out both the operation (added/removed) and the todo text @ci-ignore 
     * from the line
     */
    const todoLinesRegex = new RegExp(/(?!.*?ci-ignore.*?)(?=(?:(?:^[\+-]\s+[\/\*]+)|(?:.*?\/[\/\*])).*?todo)(?<operation>^[\+-])\s.*?[\/\*]+.*?(?<todoText>todo.*?)*$/gim)
    while ((matchLine = todoLinesRegex.exec(p.patchBody)) !== null ) {
      const { operation, todoText } = matchLine.groups
      const todo = {
        operation: operation,
        file: p.fileA,
        todoLine: todoText,
        jiraStories: []
      }
      todoHasJIRA = new RegExp(`(${jiraProjectKey}-\\d+)`,"gim")
      while((hasJira = todoHasJIRA.exec(todoText)) !== null) {
        todo.jiraStories.push((hasJira[1]).toUpperCase())
      }
      if (todos.filter(t=>t.file != todo.file && t.todoLine == todo.todoline)){

      }
      todos.push(todo)
    }
  })
   
  return todos
}


const formatTodos = (todos)=> todos.map(t=>(
    (t.jiraStories.length>0 ? ( "["+t.jiraStories.join(" ")+"]") : "[NO JIRA]") + 
    " " + t.file+": " + t.todoLine
  )).join("\n")


 
 module.exports = {
   getRepoInfo,
   getPatches,
   getTodos,
   getLog,
   getConventionalCommitStats,
   formatTodos,
   getRevList
 }
 
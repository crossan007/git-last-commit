/**
 * Adapted from https://github.com/seymen/git-last-commit
 */
 const process = require('child_process');
 const e = require('cors');
 const executeCommand = (command, options) => {
   return new Promise((resolve,reject) =>{
     let dst = __dirname
 
     if(!!options && options.dst) {
       dst = options.dst
     }
     process.exec(command, {cwd: dst}, function(err, stdout, stderr) {
       if (stderr) {
         reject(stderr)
         return
       }
       resolve(stdout)
     })
   });
 }
 
 const getLog = async () =>{
   const splitCharacter = '<##>';
   const LogAttributes = [
     {symbol: "%h", name: "shortHash"}, 
     {symbol: "%H", name: "hash"}, 
     {symbol: "%s", name: "subject"}, 
     {symbol: "%f", name: "sanitizedSubject"}, 
     {symbol: "%b", name: "body"}, 
     {symbol: "%at", name: "authoredOn"}, 
     {symbol: "%ct", name: "committedOn"}, 
     {symbol: "%an", name: "author.name"}, 
     {symbol: "%ae", name: "author.email"}, 
     {symbol: "%cn", name: "committer.name"}, 
     {symbol: "%ce", name: "committer.email"}, 
     {symbol: "%N", name: "notes"}
   ]
   const command =  'git log -1 --pretty=format:"' + LogAttributes.map(f=>f.symbol).join(splitCharacter) +'"';
   const res = await executeCommand(command);
   let response = {};
   res.split(splitCharacter).forEach((d,i,a) => {
     const keyName = LogAttributes[i].name
     if (keyName.includes(".")) {
       const s = keyName.split(".")
       response [s[0]] = {
         [s[1]]: s
       }
     }
     else {
       response[keyName] = d;
     }
   })
 
   return response
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
   const [commit, head, tag, status] = await Promise.all([
     getLog(),
     getHead(),
     getTags(),
     getStatus()
   ]);
   const o = {
     commmit: commit,
     head: head,
     tags: tag,
     status: status
   }
   return o;
 }
 
 module.exports = {
   getRepoInfo
 }
 
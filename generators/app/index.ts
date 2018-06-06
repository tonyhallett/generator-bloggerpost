import * as Generator from 'yeoman-generator';
import {PromptHelper} from 'yeoman-prompthelper';
import * as path from 'path'
var isValidPath:(pathToCheck:string)=>boolean = require('is-valid-path');

//#region helpers
function splitSafeSpaceDelimit(value:string){
  const delimited = value.split(" ").filter((v)=>v.length>0);
  return delimited;
}
function trimFilter(value:string){
  return value.trim();
}
function hasValueOneWord(value:string){
  return value!==""&&value.split(" ").length===1;
}
function hasValue(value:string){
  return value.trim()!=="";
}
//#endregion

interface BloggerPost{
  blogId:string
  title:string,
  titleLink:string,


  labels:string[],
  customMetadata:string,
  storePath:string,
  clientPath?:string,
  clientIdEnv?:string,
  clientSecretEnv?:string,
  indent:string|number,
  contentFilePath:string
}

enum IdAndSecretChoice {Store,Path,EnvVar}

interface ClientEnvNames{
  clientId:string,
  clientSecret:string
}

export = class BloggerPostGenerator extends Generator{
  idAndSecretChoice=IdAndSecretChoice.Store
  idAndSecretPath=""
  useDefaultEnvNames=true
  clientIdEnv=""
  clientSecretEnv=""
  blogId:string=""
  storePath:string=""
  contentFilePath=""
  indent:string|number="";
  postTitle:string=""
  postTitleLink:string=""
  postLabels:string[]=[]
  postCustomMetadata:string=""
  postTemplatePath=""
  postTemplateDestination=""
  promptHelper:PromptHelper<BloggerPostGenerator>
  constructor(args: string|string[], options: {}){
    super(args,options);
    this.promptHelper=new PromptHelper<BloggerPostGenerator>(this,false);
  }
  //#region prompts
  _promptPathValidateAndAssign(name:"storePath"|"idAndSecretPath"|"postTemplatePath",message:string,validate=true){
    const fs=this.fs;
    const question:any={
      name:name,
      message:message,
      store:true,
      filter:trimFilter
    }
    if(validate){
      question.validate=function validate(path:string){
        return fs.exists(path);
      }
    }
    return this.promptHelper.singleQuestionPromptAndAssign(question)
  }

  _promptBloggerId(){
    return this.promptHelper.singleQuestionPromptAndAssign(
    {
      name:"blogId",
      message:"Enter the blogger blog id",
      store:true,
      filter:trimFilter,
      validate:hasValueOneWord
    });
  }


  _promptStorePath(){
      return this._promptPathValidateAndAssign("storePath","Enter the path to the store",this.idAndSecretChoice===IdAndSecretChoice.Store);
  }

  _promptIndent(){
    return this.promptHelper.singleQuestionPromptAndAssign(
    {
      name:"indent",
      message:"Enter the indent",
      store:true,
      filter:function filter(value:string){
        let expectedValue:number|string=value;
        if (!isNaN(Number(value))) {
          expectedValue = Number(value);
        }
        return expectedValue;
      }
    });
  }

  //#region clientIdAndSecret
  _promptClientIdAndSecretPath(){
    return this._promptPathValidateAndAssign("idAndSecretPath","Enter the path to the clientId and clientSecret");
  }
  _promptClientIdEnv(){
    return this.promptHelper.singleQuestionPromptAndAssign(
      {
        message:"What is the clientId",
        name:"clientIdEnv",
        store:true,
        filter:trimFilter,
        validate:hasValueOneWord
      });
  }
  _promptClientSecretEnv(){
    return this.promptHelper.singleQuestionPromptAndAssign(
      {
        message:"What is the clientSecret",
        name:"clientSecretEnv",
        store:true,
        filter:trimFilter,
        validate:hasValueOneWord
      });
  }
  _promptEnvVarNames(){
    return this._promptClientIdEnv().then(()=>this._promptClientSecretEnv());
  }
  _promptUseDefaultEnvNames(){
    return this.promptHelper.singleQuestionPromptAndAssign({
      type:"confirm",
      name:"useDefaultEnvNames",
      message:"Use default names",
      store:true
    });
  }
  _promptEnvVar(){
    return this._promptUseDefaultEnvNames().then(()=>{
      if(!this.useDefaultEnvNames){
        return this._promptEnvVarNames();
      }
    })
  }
  _promptClientIdAndClientSecretChoice(){
    return this.promptHelper.singleQuestionPromptAndAssign({
      type:"list",
      store:true,
      name:"idAndSecretChoice",
      message:"Choose how to find the clientId and clientSecret",
      choices:[{
        value:IdAndSecretChoice.Store,
        name:"In the store"
      },{
        value:IdAndSecretChoice.Path,
        name:"By path"
      },{
        value:IdAndSecretChoice.EnvVar,
        name:"Environment variable"
      }]
    })
  }
  _promptClientIdAndClientSecret(){
    return this._promptClientIdAndClientSecretChoice().then(()=>{
      switch(this.idAndSecretChoice){
        case IdAndSecretChoice.Path:
          return this._promptClientIdAndSecretPath();
        case IdAndSecretChoice.EnvVar:
          return this._promptEnvVar();
      }
    })
  }
  //#endregion
  //#region post details

  _promptTitle(){
    return this.promptHelper.singleQuestionPromptAndAssign(
    {
      name:"postTitle",
      message:"What is the blog title",
      validate:hasValue
    });
  }

  _promptTitleLink(){
    return this.promptHelper.singleQuestionPromptAndAssign(
    {
      name:"postTitleLink",
      message:"What is the blog title link",
    });
  }

  _promptLabels(){
    return this.promptHelper.singleQuestionPromptAndAssign(
    {
      name:"postLabels",
      message:"What are the blog title labels ( space delimit )",
      filter:splitSafeSpaceDelimit
    });
  }

  _promptCustomMetadata(){
    return this.promptHelper.singleQuestionPromptAndAssign(
    {
      name:"postCustomMetadata",
      message:"What is the custom metadata",
    });
  }

  _promptPostDetails(){
    return this._promptTitle().
      then(()=>this._promptTitleLink()).
      then(()=>this._promptLabels()).
      then(()=>this._promptCustomMetadata())

  }
  //#endregion

  _promptContentFilePath(){
    function getTemplateDefaultContentFile(postTemplatePath:string){
      const parsed=path.parse(postTemplatePath)
      let name=parsed.name;
      if(name.toLowerCase()!=="template"){
        name=name.replace(/template/i, "");
      }
      return ".." + path.sep + name + parsed.ext;
    }
    //the default will only be used until have prompted with that name and store=true
    let defaultContentFilePath=".." + path.sep + "post.html";
    let name="contentFilePath";
    if(this.postTemplatePath!==""){
      defaultContentFilePath=getTemplateDefaultContentFile(this.postTemplatePath);
      name+=":" + this.postTemplatePath;
    }
    return this.promptHelper.unsafeSingleQuestionPrompt({
      message:"What is the post content file path",
      name:name,
      store:true,
      default:defaultContentFilePath,
      validate:isValidPath
    }).then(a=>{
      this.contentFilePath=a;
    });

  }
  //#region template
  _promptUseTemplate(){
    return this.promptHelper.singleQuestionPrompt<boolean>({
      type:"confirm",
      name:"usingPostTemplate",
      message:"Are you using a post template",
      store:true
    })
  }
  _promptTemplatePath(){
    return this._promptPathValidateAndAssign("postTemplatePath","Enter the path to the post template");
  }
  _promptTemplateDestinationPath(){

    let name="templateDestinationPath:"+this.postTemplatePath;
    const defaultDestinationPath="." + path.sep +path.basename(this.postTemplatePath);


    return this.promptHelper.unsafeSingleQuestionPrompt({
      message:"What is the post template destination path",
      name:name,
      store:true,
      default:defaultDestinationPath,
      validate:isValidPath
    }).then(destination=>{
      this.postTemplateDestination=destination;
    });
  }
  _promptTemplate(){
    return this._promptUseTemplate()
      .then(useTemplate=>{
        if(useTemplate){
          return this._promptTemplatePath().
          then(()=>this._promptTemplateDestinationPath())
        }else{
          return Promise.resolve();
        }
      });
  }
  //#endregion
  prompting() {
      return this._promptClientIdAndClientSecret()
        .then(()=>this._promptStorePath())
        .then(()=>this._promptTemplate())
        .then(()=>this._promptContentFilePath())
        .then(()=>this._promptBloggerId())
        .then(()=>this._promptIndent())
        .then(()=>this._promptPostDetails())
        .then(()=>this._installBloggerPost());
  }
  //#endregion
  _installBloggerPost(){
    this.npmInstall("blogger-post",{global:true});
  }
  _getBloggerPost():BloggerPost{
    const bloggerPost:BloggerPost={
      blogId:this.blogId,
      customMetadata:this.postCustomMetadata,
      labels:this.postLabels,
      title:this.postTitle,
      titleLink:this.postTitleLink,
      contentFilePath:this.contentFilePath,
      indent:this.indent,
      storePath:this.storePath

    }
    if(this.idAndSecretChoice===IdAndSecretChoice.Path){
      bloggerPost.clientPath=this.idAndSecretPath;
    }else{
      if(this.idAndSecretChoice===IdAndSecretChoice.EnvVar&&!this.useDefaultEnvNames){
        bloggerPost.clientIdEnv=this.clientIdEnv;
        bloggerPost.clientSecretEnv=this.clientSecretEnv;
      }
    }
    return bloggerPost;
  }
  writing() {
    if(this.postTemplatePath!==""){
      this.fs.copy(this.postTemplatePath,this.destinationPath(this.postTemplateDestination));
    }
    this.fs.extendJSON(this.destinationPath("package.json"),{bloggerPost:this._getBloggerPost()});
  }
}



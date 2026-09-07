import { W,H,type Tool,type World } from './model';
type RegisteredTool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
type Context={registerTool:(tool:RegisteredTool,options:{signal:AbortSignal})=>void|Promise<void>};
export function registerCityTools(world:World,edit:(t:Tool,x:number,y:number)=>string){
  const context=(document as Document&{modelContext?:Context}).modelContext;
  if(!context?.registerTool)return()=>{};
  const controller=new AbortController();
  const definitions:RegisteredTool[]=[{
    name:'inspect_city',description:'Read Qinghe city buildings, tree count, and map boundaries.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},
    execute:()=>({width:W,height:H,trees:world.trees.length,buildings:world.buildings.map(({id,name,kind,x,y,w,h,added})=>({id,name,kind,x,y,width:w,height:h,playerBuilt:!!added}))}),
  },{
    name:'edit_city',description:'Place one tree or house on vacant land, or erase one player-created object. Updates the same visible city as the construction tools. Changes last for the current page session.',
    inputSchema:{type:'object',properties:{tool:{type:'string',enum:['tree','home','erase']},x:{type:'number',minimum:0,maximum:W},y:{type:'number',minimum:0,maximum:H}},required:['tool','x','y'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute:(input:unknown)=>{if(!input||typeof input!=='object')throw new Error('Expected an edit object');const {tool,x,y}=input as Record<string,unknown>;if(!['tree','home','erase'].includes(String(tool))||typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>W||y<0||y>H)throw new Error('Invalid tool or map coordinates');const result=edit(tool as Tool,x,y);return{message:result,buildings:world.buildings.length,trees:world.trees.length};},
  }];
  for(const definition of definitions){try{void Promise.resolve(context.registerTool(definition,{signal:controller.signal})).catch(error=>console.warn('City tools unavailable',error));}catch(error){console.warn('City tools unavailable',error);}}
  return()=>controller.abort();
}

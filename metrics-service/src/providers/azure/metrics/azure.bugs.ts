import {IAzureMetadata, IAzureResponse, IAzureWIQLResponse, IAzureWorkItem} from "../azure.types";
import {logger} from "../../../shared/logger";
import axios from "axios";
import {IPoint} from "influx";

export async function getBugs(metadata: IAzureMetadata) {
  const ids = await queryBugs(metadata);

  const bugs = await getDetails(metadata, ids.toString());
  
  return bugs.filter(filter).map(map);
}

async function queryBugs(metadata: IAzureMetadata) {
  logger.info(`Querying for bugs on Azure Devops for ${metadata.organization} - ${metadata.project}`);

  const res = await axios.post<IAzureWIQLResponse>(
    //`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/wiql?api-version=4.0`, // &$top=2000
    //`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/wiql?api-version=4.0&$top=2000`, 
    `http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/wiql?api-version=4.0&$top=10000`, 
    { query: metadata.bugsQuery },
    { auth: { username: 'username', password: metadata.key } }
  );

  if (!res.data.workItems) {
    throw new Error(`Error querying for bugs on Azure Devops, status code: ${res.status}`);
  }

  return res.data.workItems.map((wi: { id: any; }) => wi.id);
}

async function getDetails(metadata: IAzureMetadata, ids: string) {

logger.info(`Getting bug details...`);

//const PromiseArr: any[] = [];
const metrics: any[] = [];

var arrayOfStrings = ids.toString().split(",");
var postingStr="";
for (var i = 0; i < arrayOfStrings.length; i++){
  postingStr = postingStr + arrayOfStrings[i] + ",";
   if (i % 10 == 0 && i>0 )
   {
    postingStr = postingStr.slice(0, -1) // remove last ','
    //PromiseArr.push( await axios.get<IAzureResponse<IAzureWorkItem>>(`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/workitems?ids=${postingStr}&fields=System.State,System.CreatedDate,System.ChangedDate,System.TeamProject,System.WorkItemType,System.Title,System.AreaPath,System.IterationPath&api-version=4.1`, { auth: { username: 'username', password: metadata.key } }  ) );
    logger.info(`Getting work item info for ids: ${postingStr} `);
    const res = await axios.get<IAzureResponse<IAzureWorkItem>>(`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/workitems?ids=${postingStr}&fields=System.State,System.CreatedDate,System.ChangedDate,System.TeamProject,System.WorkItemType,System.Title,System.AreaPath,System.IterationPath&api-version=4.1`, { auth: { username: 'username', password: metadata.key } }  )
    metrics.push(...res.data.value);
    postingStr=""; //reset
   }
}
postingStr = postingStr.slice(0, -1) // remove last ','
//PromiseArr.push ( await axios.get<IAzureResponse<IAzureWorkItem>>(`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/workitems?ids=${postingStr}&fields=System.State,System.CreatedDate,System.ChangedDate,System.TeamProject,System.Title,System.AreaPath,System.IterationPath&api-version=4.1`, { auth: { username: 'username', password: metadata.key } }  ));
logger.info(`Getting last work item info for ids: ${postingStr} `);
const res = await axios.get<IAzureResponse<IAzureWorkItem>>(`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/workitems?ids=${postingStr}&fields=System.State,System.CreatedDate,System.ChangedDate,System.TeamProject,System.WorkItemType,System.Title,System.AreaPath,System.IterationPath&api-version=4.1`, { auth: { username: 'username', password: metadata.key } }  )
metrics.push(...res.data.value);


//const promiseResult = Promise.all(PromiseArr).then(promiseResult => {
//logger.info(`Preparing promise calls to get bugs`);
//var resArray = [];
//for(var promiseResultElement of promiseResult){
//    if (!promiseResultElement.data.value) {
//      throw new Error(`Error querying for bugs on Azure Devops, status code: ${promiseResultElement.status}`);
//    }
//    resArray.push(...promiseResultElement.data.value);
//}
//return resArray;
//});
//logger.info(`Returning bugs`);
//return promiseResult;

logger.info(`Returning bugs`);
return metrics;

}

function filter(workItem: IAzureWorkItem): boolean {
  //for now, let's keep the 'filter' only in the WIQL query
  //return !! ((workItem.fields["System.State"] != 'Active') && (workItem.fields["System.State"] != 'New') );
  return !! ((workItem.fields["System.WorkItemType"] == 'Bug') 
              ||(workItem.fields["System.WorkItemType"] == 'Epic') 
              ||(workItem.fields["System.WorkItemType"] == 'Feature') 
              ||(workItem.fields["System.WorkItemType"] == 'User Story') 
              ||(workItem.fields["System.WorkItemType"] == 'Task') 
            );
  //return !! (true);
}

function map(workItem: IAzureWorkItem): IPoint {
  return {
    timestamp: new Date(workItem.fields["System.ChangedDate"]),
    measurement: 'bug',
    tags: {
      provider: 'azure',
      project: workItem.fields["System.TeamProject"],
      iterationpath: workItem.fields["System.IterationPath"]
    },
    fields: {
      duration: new Date(workItem.fields["System.ChangedDate"]).getTime() - new Date(workItem.fields["System.CreatedDate"]).getTime(),
      state: workItem.fields["System.State"],
      type: workItem.fields["System.WorkItemType"],
      title: workItem.fields["System.Title"],
      areapath : workItem.fields["System.AreaPath"],
    }
  }
}

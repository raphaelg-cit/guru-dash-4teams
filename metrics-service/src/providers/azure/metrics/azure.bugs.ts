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
    `http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/wiql?api-version=4.0`, // &$top=2000
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

const PromiseArr: any[] = [];

var arrayOfStrings = ids.toString().split(",");
var postingStr="";
for (var i = 0; i < arrayOfStrings.length; i++){
  postingStr = postingStr + arrayOfStrings[i] + ",";
   if (i % 10 == 0 && i>0 )
   {
    postingStr = postingStr.slice(0, -1) // remove last ','
    PromiseArr.push( await axios.get<IAzureResponse<IAzureWorkItem>>(`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/workitems?ids=${postingStr}&fields=System.State,System.CreatedDate,System.ChangedDate&api-version=4.1`, { auth: { username: 'username', password: metadata.key } }  ) );
    postingStr=""; //reset
   }
}
postingStr = postingStr.slice(0, -1) // remove last ','
PromiseArr.push ( await axios.get<IAzureResponse<IAzureWorkItem>>(`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/wit/workitems?ids=${postingStr}&fields=System.State,System.CreatedDate,System.ChangedDate&api-version=4.1`, { auth: { username: 'username', password: metadata.key } }  ));

const promiseResult = Promise.all(PromiseArr).then(promiseResult => {
logger.info(`Preparing promise calls to get bugs`);
var resArray = [];
for(var promiseResultElement of promiseResult){
    if (!promiseResultElement.data.value) {
      throw new Error(`Error querying for bugs on Azure Devops, status code: ${promiseResultElement.status}`);
    }
    resArray.push(...promiseResultElement.data.value);
}
return resArray;
});
logger.info(`Returning bugs`);
return promiseResult;

}

function filter(workItem: IAzureWorkItem): boolean {
  //for now, let's keep the 'filter' only in the WIQL query
  //return !! ((workItem.fields["System.State"] != 'Active') && (workItem.fields["System.State"] != 'New') );
  return !! (true);
}

function map(workItem: IAzureWorkItem): IPoint {
  return {
    timestamp: new Date(workItem.fields["System.ChangedDate"]),
    measurement: 'bug',
    tags: {
      provider: 'azure'
    },
    fields: {
      duration: new Date(workItem.fields["System.ChangedDate"]).getTime() - new Date(workItem.fields["System.CreatedDate"]).getTime(),
      state: workItem.fields["System.State"]
    }
  }
}

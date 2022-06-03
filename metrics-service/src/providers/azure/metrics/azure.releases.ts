import axios from "axios";
import { IPoint } from "influx";
import { IAzureMetadata, IAzureRelease, IAzureResponse } from "../azure.types";
import { logger } from '../../../shared/logger';

export async function getReleases(metadata: IAzureMetadata) {
  logger.info(`Getting Release Information from Azure Devops for ${metadata.organization} - ${metadata.project}`);
  
  var deploymentAPI = `http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/release/deployments?`;
  if( metadata.workItemsLastMonths){
    const minDate = new Date();
    logger.info(`Getting Deployment Data from the last ${metadata.workItemsLastMonths} months...`);
    minDate.setMonth(minDate.getMonth() - Number(metadata.workItemsLastMonths));
    const minStartedTime = minDate.toISOString();
    deploymentAPI = deploymentAPI.concat("minStartedTime=" + minStartedTime + "&")
  }else{
    logger.warn(`Warning: Getting Deployment Data without filter of months!!!`);
    logger.warn(`You may get incosistent time fields, thus pls provide workItemsLastMonths in strapi\n\n`);
  }

  const metrics: IPoint[] = [];
  let continuationToken = 0;

  while (continuationToken >= 0) {
    continuationToken > 0 && logger.debug(`Getting next page continuationToken: ${continuationToken}`);
    //logger.debug(deploymentAPI + `continuationToken=${continuationToken}`);
    const res = await axios.get<IAzureResponse<IAzureRelease>>(
      (deploymentAPI + `continuationToken=${continuationToken}`  ),
      { auth: { username: 'username', password: metadata.key } }
    );
    metrics.push(...res.data.value.filter(release => predicate(metadata, release)).map(map));
    continuationToken = Number(res.headers['x-ms-continuationtoken']);
  }

  return metrics;
}

// Filtra apenas releases de Produção
function predicate(metadata: IAzureMetadata, release: IAzureRelease): boolean {
  //const isValidDate = (dateObject: string | number | Date) => new Date(dateObject).toString() !== 'Invalid Date';
  //if (metadata.releases.includes(release.releaseEnvironment.name) && (isValidDate(release.completedOn)) && (isValidDate(release.startedOn)) ){
  //  return true;
  //}
  //logger.debug(`Dropping record - environment:${release.releaseEnvironment.name}, completedOn:${release.completedOn}, startedOn:${release.startedOn}`);
  //return false;
  return true;
}

function map(release: IAzureRelease): IPoint {
  return {
    measurement: 'deploy',
    tags: { 
      project: release.releaseDefinition.name? release.releaseDefinition.name : "",
    },
    fields: { 
      duration: release.completedOn ? release.startedOn?  (new Date(release.completedOn).getTime() - new Date(release.startedOn).getTime()) :null  : null,
      success: release.deploymentStatus ? (release.deploymentStatus === 'succeeded' ? 1 : 0) : null,
      releaseEnvironmentName: release.releaseEnvironment.name ? release.releaseEnvironment.name : null
    },
    timestamp: release.startedOn? new Date(release.startedOn) : new Date(),
  }
}
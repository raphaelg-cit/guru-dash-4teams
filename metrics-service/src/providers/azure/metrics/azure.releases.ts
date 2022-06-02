import axios from "axios";
import { IPoint } from "influx";
import { IAzureMetadata, IAzureRelease, IAzureResponse } from "../azure.types";
import { logger } from '../../../shared/logger';

export async function getReleases(metadata: IAzureMetadata) {
  logger.info(`Getting Release Information from Azure Devops for ${metadata.organization} - ${metadata.project}`);

  const minDate = new Date();
  logger.info(`Getting Data from the last ${metadata.workItemsLastMonths} months`);
  minDate.setMonth(minDate.getMonth() - Number(metadata.workItemsLastMonths));
  const minStartedTime = minDate.toISOString();
  

  const metrics: IPoint[] = [];
  let continuationToken = 0;

  while (continuationToken >= 0) {
    continuationToken > 0 && logger.debug(`Getting next page continuationToken: ${continuationToken}`);
    
    const res = await axios.get<IAzureResponse<IAzureRelease>>(
      `http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/release/deployments?continuationToken=${continuationToken}&minStartedTime=${minStartedTime}`,
      //`http://tfs-agora.corpt.bradesco.com.br/tfs/${metadata.organization}/${metadata.project}/_apis/release/deployments?continuationToken=${continuationToken}`,
      { auth: { username: 'username', password: metadata.key } }
    );

    metrics.push(...res.data.value.filter(release => predicate(metadata, release)).map(map));
    //metrics.push(...res.data.value.map(map));
    continuationToken = Number(res.headers['x-ms-continuationtoken']);
  }

  return metrics;
}

// Filtra apenas releases de Produção
function predicate(metadata: IAzureMetadata, release: IAzureRelease): boolean {
  //return metadata.releases.includes(release.releaseEnvironment.name);
  return true;
}

function map(release: IAzureRelease): IPoint {
  return {
    measurement: 'deploy',
    tags: { 
      project: release.releaseDefinition.name,
    },
    fields: { 
      duration: new Date(release.completedOn).getTime() - new Date(release.startedOn).getTime(),
      success: release.deploymentStatus === 'succeeded' ? 1 : 0,
      releaseEnvironmentName: release.releaseEnvironment.name
    },
    timestamp: new Date(release.startedOn),
  }
}
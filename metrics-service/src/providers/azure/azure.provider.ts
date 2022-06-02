import {IAzureMetadata} from "./azure.types";

import {getWorkitems} from "./metrics/azure.workitems";
import {getReleases} from "./metrics/azure.releases";
import {getBuilds} from "./metrics/azure.builds";

export async function getAzureMetrics(metadata: IAzureMetadata) {
  const builds = await getBuilds(metadata);
  const releases = await getReleases(metadata);
  const workitems = await getWorkitems(metadata);

  return [...builds, ...releases, ...workitems];
}

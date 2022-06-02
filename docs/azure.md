## AZURE Details

### The Meta should be configured as follows:
```
{
  "key": "123",
  "organization": "Your Organization",
  "project": "Your Project",
  "releases": [
    "Name of the stages in the pipeline that should be considered as deploys"
  ],
  "workitemsQuery": "WIQL to query workitems in Azure Devops",
  "workItemsLastMonths": "Number of last months to be considered in the query of workitems"
}
```
#### Provider name: azure

The supported metrics are:
- build
- release
- workitem